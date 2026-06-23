import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  ensureSchema, insertAccount, listAccounts, getAccount, getAssessment, driver,
} from './db.js';
import { parseAccounts } from './ingest.js';
import { assessAccount } from './pipeline.js';
import { toCsv } from './export.js';
import { screenshotsEnabled } from './screenshot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Liveness probe — independent of the database so it can diagnose DB issues.
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      driver,
      scoringConfigured: Boolean(config.anthropicApiKey),
      screenshotsEnabled: screenshotsEnabled(),
      searchFallback: Boolean(config.serpApiKey),
      model: config.scoreModel,
    });
  });

  // Lazily create tables once per warm instance before handling data routes.
  app.use('/api', async (req, res, next) => {
    try {
      await ensureSchema();
      next();
    } catch (err) {
      console.error('[schema]', err.message);
      res.status(500).json({ error: 'Database unavailable. Check DATABASE_URL.' });
    }
  });

  // --- Ingestion ----------------------------------------------------------
  app.post('/api/sessions/:sessionId/accounts', async (req, res) => {
    const { sessionId } = req.params;
    const { text } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Provide CSV or pasted-table text in "text".' });
    }
    const { accounts, duplicates, errors, truncated } = parseAccounts(text);
    let inserted = 0;
    for (const acct of accounts) {
      await insertAccount({ ...acct, session_id: sessionId });
      inserted += 1;
    }
    res.json({ inserted, duplicates, errors, truncated });
  });

  // --- Listing ------------------------------------------------------------
  app.get('/api/sessions/:sessionId/accounts', async (req, res) => {
    res.json({ accounts: await listAccounts(req.params.sessionId) });
  });

  app.get('/api/accounts/:id', async (req, res) => {
    const account = await getAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Not found' });
    const assessment = await getAssessment(account.id);
    if (assessment && typeof assessment.flags === 'string') {
      try { assessment.flags = JSON.parse(assessment.flags); } catch { assessment.flags = []; }
    }
    res.json({ account, assessment });
  });

  // --- Assessment (synchronous: does the work, returns the result) --------
  app.post('/api/accounts/:id/assess', async (req, res) => {
    const id = Number(req.params.id);
    if (!(await getAccount(id))) return res.status(404).json({ error: 'Not found' });
    try {
      const result = await assessAccount(id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Export -------------------------------------------------------------
  app.get('/api/sessions/:sessionId/export.csv', async (req, res) => {
    let rows = (await listAccounts(req.params.sessionId)).filter((a) => a.overall_score != null);
    if (req.query.ids) {
      const set = new Set(String(req.query.ids).split(',').map(Number));
      rows = rows.filter((a) => set.has(a.id));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="assessment-${req.params.sessionId}-${Date.now()}.csv"`);
    res.send(toCsv(rows));
  });

  // --- Screenshot serving (local filesystem only; no-op on Vercel) --------
  app.get('/api/screenshots/:id/:variant', async (req, res) => {
    const assessment = await getAssessment(Number(req.params.id));
    if (!assessment) return res.status(404).end();
    const p = req.params.variant === 'mobile'
      ? assessment.screenshot_mobile_path
      : assessment.screenshot_desktop_path;
    if (!p || p.startsWith('s3://') || !fs.existsSync(p)) return res.status(404).end();
    res.sendFile(path.resolve(p));
  });

  return app;
}
