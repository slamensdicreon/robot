import { config } from './config.js';

const LEGAL_SUFFIXES = /\b(llc|l\.l\.c|inc|incorporated|llp|corp|corporation|ltd|limited|plc|co|company|gmbh|sa|nv|ag)\b\.?/gi;
const COMMON_WORDS = /\b(the|group|holdings|holding|international|global|worldwide)\b/gi;
const TLD_ORDER = ['com', 'org', 'ca', 'gov'];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Turn an account name into a domain slug. */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(COMMON_WORDS, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function candidateDomains(name) {
  const slug = slugify(name);
  if (!slug) return [];
  return TLD_ORDER.map((tld) => `https://${slug}.${tld}`);
}

/** Normalize a user-provided URL to an absolute https URL. */
export function normalizeUrl(raw) {
  if (!raw) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

async function headProbe(url, signal) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function searchFallback(name) {
  if (!config.serpApiKey) return null;
  const query = `"${name}" official website`;
  const endpoint = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${config.serpApiKey}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    const first = (data.organic_results || []).find((r) => r.link);
    return first ? first.link : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a website URL for an account (PRD 4.2).
 * Returns { url, method } or { url: null, method: 'failed' }.
 * Must complete within ~5s; we budget the HEAD probes accordingly.
 */
export async function resolveUrl(account) {
  if (account.input_url) {
    const normalized = normalizeUrl(account.input_url);
    if (normalized) return { url: normalized, method: 'provided' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    for (const candidate of candidateDomains(account.name)) {
      if (await headProbe(candidate, controller.signal)) {
        return { url: candidate, method: 'head_probe' };
      }
    }
  } finally {
    clearTimeout(timer);
  }

  const searched = await searchFallback(account.name);
  if (searched) {
    const normalized = normalizeUrl(searched);
    if (normalized) return { url: normalized, method: 'search' };
  }

  return { url: null, method: 'failed' };
}
