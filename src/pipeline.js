import { EventEmitter } from 'node:events';
import { config } from './config.js';
import { resolveUrl } from './resolver.js';
import { fetchSite } from './fetcher.js';
import { scoreAccount } from './scorer.js';
import {
  getAccount,
  updateAccountStatus,
  saveAssessment,
} from './db.js';

/** Emits 'update' { accountId, status, account } and 'batch' { sessionId, done, total }. */
export const bus = new EventEmitter();
bus.setMaxListeners(0);

// Map blockedReason / verdict to the account status enum.
function statusForBlock(reason) {
  return 'failed';
}

function statusForVerdict(verdict) {
  if (verdict === 'flagged') return 'flagged';
  if (verdict === 'modern') return 'modern';
  return 'assessed';
}

/** Run the full pipeline for a single account id. */
export async function assessAccount(accountId) {
  const account = getAccount(accountId);
  if (!account) return;

  updateAccountStatus(accountId, 'fetching');
  bus.emit('update', { accountId, status: 'fetching' });

  try {
    // 1. Resolve URL.
    const { url, method } = await resolveUrl(account);
    if (!url) {
      updateAccountStatus(accountId, 'failed', { error: 'url_resolution_failed' });
      bus.emit('update', { accountId, status: 'failed' });
      return;
    }
    updateAccountStatus(accountId, 'fetching', { resolved_url: url });

    // 2. Fetch + screenshot + tech detect.
    const fetchResult = await fetchSite(url, accountId);
    if (!fetchResult.ok) {
      updateAccountStatus(accountId, 'failed', {
        resolved_url: url,
        error: fetchResult.blockedReason || 'fetch_failed',
      });
      bus.emit('update', { accountId, status: 'failed' });
      return;
    }
    updateAccountStatus(accountId, 'fetching', { final_url: fetchResult.finalUrl });

    // 3. Score.
    const refreshed = getAccount(accountId);
    const scored = await scoreAccount({ account: refreshed, fetchResult });

    // 4. Persist.
    saveAssessment(accountId, {
      ...scored,
      fetch_duration_ms: fetchResult.fetchDurationMs,
      screenshot_desktop_path: fetchResult.screenshots?.desktopPath,
      screenshot_mobile_path: fetchResult.screenshots?.mobilePath,
    });

    const status = statusForVerdict(scored.verdict);
    updateAccountStatus(accountId, status, { assessed_at: new Date().toISOString() });
    bus.emit('update', { accountId, status });
  } catch (err) {
    console.error(`[pipeline] account ${accountId} failed:`, err.message);
    updateAccountStatus(accountId, 'failed', { error: err.message.slice(0, 300) });
    bus.emit('update', { accountId, status: 'failed' });
  }
}

/**
 * Process a list of account ids with bounded concurrency.
 * Interruptions are safe: each account persists independently, so resuming
 * re-queues only those still pending/failed.
 */
export async function runBatch(sessionId, accountIds, concurrency = config.maxConcurrentWorkers) {
  let done = 0;
  const total = accountIds.length;
  const queue = [...accountIds];

  bus.emit('batch', { sessionId, done, total, running: true });

  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (id === undefined) return;
      await assessAccount(id);
      done += 1;
      bus.emit('batch', { sessionId, done, total, running: done < total });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
  await Promise.all(workers);
  bus.emit('batch', { sessionId, done, total, running: false });
}
