import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  insertAccount,
  listAccounts,
  getAccount,
  getAssessment,
} from './db.js';
import { parseAccounts } from './ingest.js';
import { runBatch, assessAccount, bus } from './pipeline.js';
import { toCsv } from './export.js';
import { screenshotsEnabled, closeBrowser } from './screenshot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Health / capability probe -------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    scoringConfigured: Boolean(config.anthropicApiKey),
    screenshotsEnabled: screenshotsEnabled(),
    searchFallback: Boolean(config.serpApiKey),
    model: config.scoreModel,
    maxConcurrentWorkers: config.maxConcurrentWorkers,
  });
});

// --- Ingestion ------------------------------------------------------------
app.post('/api/sessions/:sessionId/accounts', (req, res) => {
  const { sessionId } = req.params;
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Provide CSV or pasted-table text in "text".' });
  }
  const { accounts, duplicates, errors, truncated } = parseAccounts(text);
  const ids = [];
  for (const acct of accounts) {
    ids.push(insertAccount({ ...acct, session_id: sessionId }));
  }
  res.json({ inserted: ids.length, duplicates, errors, truncated });
});

// --- Listing --------------------------------------------------------------
app.get('/api/sessions/:sessionId/accounts', (req, res) => {
  res.json({ accounts: listAccounts(req.params.sessionId) });
});

app.get('/api/accounts/:id', (req, res) => {
  const account = getAccount(Number(req.params.id));
  if (!account) return res.status(404).json({ error: 'Not found' });
  const assessment = getAssessment(account.id);
  if (assessment && typeof assessment.flags === 'string') {
    try {
      assessment.flags = JSON.parse(assessment.flags);
    } catch {
      assessment.flags = [];
    }
  }
  res.json({ account, assessment });
});

// --- Assessment triggers --------------------------------------------------
app.post('/api/accounts/:id/assess', (req, res) => {
  const id = Number(req.params.id);
  if (!getAccount(id)) return res.status(404).json({ error: 'Not found' });
  // Fire-and-forget; progress is delivered over SSE.
  assessAccount(id).catch((e) => console.error(e));
  res.json({ queued: true, accountId: id });
});

app.post('/api/sessions/:sessionId/assess', (req, res) => {
  const { sessionId } = req.params;
  const { ids, onlyPending = true, concurrency } = req.body || {};
  let targets = listAccounts(sessionId);
  if (Array.isArray(ids) && ids.length) {
    const set = new Set(ids.map(Number));
    targets = targets.filter((a) => set.has(a.id));
  } else if (onlyPending) {
    targets = targets.filter((a) => a.status === 'pending' || a.status === 'failed');
  }
  const accountIds = targets.map((a) => a.id);
  if (!accountIds.length) return res.json({ queued: 0 });
  runBatch(sessionId, accountIds, concurrency).catch((e) => console.error(e));
  res.json({ queued: accountIds.length });
});

// --- Export ---------------------------------------------------------------
app.get('/api/sessions/:sessionId/export.csv', (req, res) => {
  let rows = listAccounts(req.params.sessionId).filter((a) => a.overall_score != null);
  if (req.query.ids) {
    const set = new Set(String(req.query.ids).split(',').map(Number));
    rows = rows.filter((a) => set.has(a.id));
  }
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="assessment-${req.params.sessionId}-${Date.now()}.csv"`
  );
  res.send(csv);
});

// --- Screenshot serving ---------------------------------------------------
app.get('/api/screenshots/:id/:variant', (req, res) => {
  const assessment = getAssessment(Number(req.params.id));
  if (!assessment) return res.status(404).end();
  const p = req.params.variant === 'mobile'
    ? assessment.screenshot_mobile_path
    : assessment.screenshot_desktop_path;
  if (!p || p.startsWith('s3://') || !fs.existsSync(p)) return res.status(404).end();
  res.sendFile(path.resolve(p));
});

// --- Server-Sent Events for live progress ---------------------------------
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('retry: 3000\n\n');

  const send = (event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  const onUpdate = (p) => send('update', p);
  const onBatch = (p) => send('batch', p);
  bus.on('update', onUpdate);
  bus.on('batch', onBatch);

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(keepAlive);
    bus.off('update', onUpdate);
    bus.off('batch', onBatch);
  });
});

app.listen(config.port, () => {
  console.log(`Website Assessment Dashboard running on http://localhost:${config.port}`);
  if (!config.anthropicApiKey) {
    console.warn('  ! ANTHROPIC_API_KEY not set — scoring will fail until configured.');
  }
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});
