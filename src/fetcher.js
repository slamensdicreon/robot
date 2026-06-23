import * as cheerio from 'cheerio';
import { config } from './config.js';
import { throttleDomain } from './throttle.js';
import { detectTechnology } from './techDetect.js';
import { captureScreenshots } from './screenshot.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Honor robots.txt for the root path (PRD 5.4). */
async function robotsAllowsRoot(url) {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.origin}/robots.txt`;
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return true; // no robots.txt => allowed
    const text = await res.text();
    return !rootDisallowed(text);
  } catch {
    return true; // network hiccup fetching robots => don't block
  }
}

function rootDisallowed(robotsTxt) {
  // Minimal parse: look at the '*' group (and global) for "Disallow: /".
  const lines = robotsTxt.split('\n').map((l) => l.trim());
  let applies = false;
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.split(':')[1].trim();
      applies = agent === '*';
    } else if (applies && /^disallow:/i.test(line)) {
      const path = line.split(':')[1].trim();
      if (path === '/') return true;
    }
  }
  return false;
}

function looksLikeChallenge(html, status) {
  if (status === 403 || status === 503) {
    return /just a moment|checking your browser|cf-browser-verification|attention required/i.test(html);
  }
  return false;
}

/** Extract structured signals from HTML (PRD 4.3.1 step 5). */
function extractHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  const headings = { h1: [], h2: [], h3: [] };
  for (const tag of ['h1', 'h2', 'h3']) {
    $(tag).each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text) headings[tag].push(text);
    });
  }

  const nav = [];
  $('nav a, header a').each((_, el) => {
    const label = $(el).text().trim().replace(/\s+/g, ' ');
    if (label && label.length < 60 && nav.length < 25) nav.push(label);
  });

  const footerLinks = [];
  $('footer a').each((_, el) => {
    const label = $(el).text().trim().replace(/\s+/g, ' ');
    if (label && footerLinks.length < 30) footerLinks.push(label);
  });

  const hreflang = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    hreflang.push($(el).attr('hreflang'));
  });

  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    og[$(el).attr('property')] = $(el).attr('content');
  });
  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    twitter[$(el).attr('name')] = $(el).attr('content');
  });

  return {
    title: $('title').first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr('content') || null,
    headings,
    nav: [...new Set(nav)],
    footerLinks: [...new Set(footerLinks)],
    canonical: $('link[rel="canonical"]').attr('href') || null,
    hreflang,
    og,
    twitter,
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    hasMobileMenu: detectHamburger($, html),
    copyrightYear: extractCopyrightYear($.text()),
  };
}

function detectHamburger($, html) {
  if ($('[class*="hamburger"], [class*="menu-toggle"], [aria-label*="menu" i]').length > 0) {
    return true;
  }
  return /hamburger|menu-toggle|navbar-toggle/i.test(html);
}

function extractCopyrightYear(text) {
  const matches = [...text.matchAll(/(?:©|copyright|\(c\))\s*(\d{4})/gi)];
  const years = matches.map((m) => Number(m[1])).filter((y) => y >= 1995 && y <= 2100);
  return years.length ? Math.max(...years) : null;
}

/**
 * Full fetch pipeline for one account (PRD 4.3).
 * Returns { ok, status, finalUrl, fetchDurationMs, extracted, technology,
 *           screenshots, flags[], blockedReason } or an error envelope.
 */
export async function fetchSite(url, accountId) {
  const started = Date.now();

  if (!(await robotsAllowsRoot(url))) {
    return { ok: false, blockedReason: 'robots_blocked', status: null };
  }

  await throttleDomain(url);

  let res;
  let html = '';
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });
    html = await res.text();
  } catch (err) {
    return { ok: false, blockedReason: 'fetch_failed', status: null, error: err.message };
  }

  const status = res.status;
  if (looksLikeChallenge(html, status)) {
    return { ok: false, blockedReason: 'fetch_blocked', status };
  }
  if (status !== 200) {
    return { ok: false, blockedReason: 'fetch_failed', status };
  }

  const finalUrl = res.url || url;
  const extracted = extractHtml(html, finalUrl);

  // Collect headers + set-cookie names for technology detection.
  const headers = Object.fromEntries(res.headers.entries());
  const setCookie = res.headers.get('set-cookie') || '';
  const cookies = setCookie ? setCookie.split(/,(?=[^;]+=)/).map((c) => c.split('=')[0].trim()) : [];
  const technology = detectTechnology({ headers, cookies, html });

  const screenshots = await captureScreenshots(finalUrl, accountId);

  const flags = [];
  if (finalUrl.startsWith('http://')) flags.push('no_ssl');
  if (!extracted.hasViewportMeta) flags.push('no_mobile');
  if (extracted.copyrightYear && extracted.copyrightYear < new Date().getFullYear() - 1) {
    flags.push('outdated_copyright');
  }
  const fetchDurationMs = Date.now() - started;
  if (fetchDurationMs > 4000) flags.push('slow_load');

  // Mobile responsiveness verdict (PRD 4.3.4).
  let mobileResponsive = null;
  if (extracted.hasViewportMeta && (extracted.hasMobileMenu || screenshots.mobileResponsive)) {
    mobileResponsive = 'mobile_responsive';
  } else if (screenshots.mobileResponsive === false && !extracted.hasViewportMeta) {
    mobileResponsive = 'mobile_not_responsive';
  }

  return {
    ok: true,
    status,
    finalUrl,
    fetchDurationMs,
    extracted,
    technology,
    screenshots,
    mobileResponsive,
    flags,
  };
}
