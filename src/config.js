import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function resolveLocal(p, fallback) {
  const value = p || fallback;
  // Leave connection strings / remote URIs untouched; only resolve file paths.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

export const config = {
  root: ROOT,
  port: Number(process.env.PORT) || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  serpApiKey: process.env.SERP_API_KEY || '',
  screenshotStoragePath: resolveLocal(process.env.SCREENSHOT_STORAGE_PATH, './screenshots'),
  databaseUrl: resolveLocal(process.env.DATABASE_URL, './data/assessments.sqlite'),
  maxConcurrentWorkers: Number(process.env.MAX_CONCURRENT_WORKERS) || 5,
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS) || 10000,
  scoreModel: process.env.SCORE_MODEL || 'claude-sonnet-4-6',

  // Ethical-use throttle: no more than 1 request / 2s per domain (PRD 5.4).
  perDomainThrottleMs: 2000,

  // Viewports (PRD 4.3.3 / 4.3.4).
  desktopViewport: { width: 1440, height: 900 },
  mobileViewport: { width: 390, height: 844 },
  screenshotStoreWidth: 960,
  screenshotQuality: 85,
  screenshotMaxWaitMs: 8000,
};

export function assertScoringConfigured() {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env (see .env.example).');
  }
}
