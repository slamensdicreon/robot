import { config } from './config.js';

// Per-domain politeness gate (PRD 5.4): at most 1 request / 2s per host.
const lastHitByHost = new Map();

export async function throttleDomain(urlString) {
  let host;
  try {
    host = new URL(urlString).host;
  } catch {
    return;
  }
  const now = Date.now();
  const last = lastHitByHost.get(host) || 0;
  const wait = last + config.perDomainThrottleMs - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastHitByHost.set(host, Date.now());
}
