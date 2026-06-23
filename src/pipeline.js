/**
 * Single-account assessment pipeline: resolve → fetch → score → persist.
 *
 * On serverless there is no background work after the HTTP response, so this
 * runs synchronously within one request and returns the result. Batch
 * processing is orchestrated by the client, which calls this per account with
 * bounded concurrency.
 */
import { resolveUrl } from './resolver.js';
import { fetchSite } from './fetcher.js';
import { scoreAccount } from './scorer.js';
import { getAccount, getAssessment, updateAccountStatus, saveAssessment } from './db.js';

function statusForVerdict(verdict) {
  if (verdict === 'flagged') return 'flagged';
  if (verdict === 'modern') return 'modern';
  return 'assessed';
}

/**
 * Run the full pipeline for one account id.
 * Returns { account, assessment } reflecting the final persisted state.
 */
export async function assessAccount(accountId) {
  const account = await getAccount(accountId);
  if (!account) return null;

  await updateAccountStatus(accountId, 'fetching');

  try {
    // 1. Resolve URL.
    const { url } = await resolveUrl(account);
    if (!url) {
      await updateAccountStatus(accountId, 'failed', { error: 'url_resolution_failed' });
      return finalState(accountId);
    }
    await updateAccountStatus(accountId, 'fetching', { resolved_url: url });

    // 2. Fetch + (optional) screenshot + technology detection.
    const fetchResult = await fetchSite(url, accountId);
    if (!fetchResult.ok) {
      await updateAccountStatus(accountId, 'failed', {
        resolved_url: url,
        error: fetchResult.blockedReason || 'fetch_failed',
      });
      return finalState(accountId);
    }
    await updateAccountStatus(accountId, 'fetching', { final_url: fetchResult.finalUrl });

    // 3. Score (multimodal when a screenshot is available, else HTML-only).
    const refreshed = await getAccount(accountId);
    const scored = await scoreAccount({ account: refreshed, fetchResult });

    // 4. Persist.
    await saveAssessment(accountId, {
      ...scored,
      fetch_duration_ms: fetchResult.fetchDurationMs,
      screenshot_desktop_path: fetchResult.screenshots?.desktopPath,
      screenshot_mobile_path: fetchResult.screenshots?.mobilePath,
    });
    await updateAccountStatus(accountId, statusForVerdict(scored.verdict), {
      assessed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[pipeline] account ${accountId} failed:`, err.message);
    await updateAccountStatus(accountId, 'failed', { error: String(err.message).slice(0, 300) });
  }

  return finalState(accountId);
}

async function finalState(accountId) {
  const account = await getAccount(accountId);
  const assessment = await getAssessment(accountId);
  if (assessment && typeof assessment.flags === 'string') {
    try { assessment.flags = JSON.parse(assessment.flags); } catch { assessment.flags = []; }
  }
  return { account, assessment };
}
