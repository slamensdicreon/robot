/**
 * Technology detection (PRD 4.3.2).
 * Scans response headers, cookies, and HTML for platform signals.
 * Returns { platform, confidence, signals[] } where confidence is:
 *   high     — 2+ signals agree on the same platform
 *   medium   — single strong signal (header/cookie)
 *   low      — single weak signal (html/script/css)
 *   unknown  — nothing matched
 */

const RULES = [
  // Sitecore
  { platform: 'Sitecore', type: 'header', re: /x-sitecore-requestid/i, weight: 'strong', field: 'headerKeys' },
  { platform: 'Sitecore', type: 'cookie', re: /SC_ANALYTICS_GLOBAL_COOKIE/i, weight: 'strong', field: 'cookies' },
  { platform: 'Sitecore', type: 'script', re: /\/sitecore\//i, weight: 'weak', field: 'html' },
  { platform: 'Sitecore', type: 'css', re: /class="[^"]*\b(sxa-|scf-)/i, weight: 'weak', field: 'html' },
  { platform: 'Sitecore', type: 'html', re: /<!--\s*sitecore/i, weight: 'weak', field: 'html' },

  // WordPress
  { platform: 'WordPress', type: 'meta', re: /<meta[^>]+name=["']generator["'][^>]+WordPress/i, weight: 'strong', field: 'html' },
  { platform: 'WordPress', type: 'cookie', re: /wordpress_logged_in_/i, weight: 'strong', field: 'cookies' },
  { platform: 'WordPress', type: 'script', re: /\/wp-content\/|\/wp-includes\//i, weight: 'weak', field: 'html' },
  { platform: 'WordPress', type: 'header', re: /x-powered-by.*w3\s*total\s*cache/i, weight: 'weak', field: 'headerValues' },

  // Drupal
  { platform: 'Drupal', type: 'header', re: /x-generator.*drupal/i, weight: 'strong', field: 'headerValues' },
  { platform: 'Drupal', type: 'script', re: /\/sites\/default\/files\//i, weight: 'weak', field: 'html' },
  { platform: 'Drupal', type: 'css', re: /class="[^"]*\bviews-/i, weight: 'weak', field: 'html' },
  { platform: 'Drupal', type: 'html', re: /data-drupal-/i, weight: 'weak', field: 'html' },

  // Adobe Experience Manager
  { platform: 'Adobe AEM', type: 'script', re: /\/etc\.clientlibs\/|\/content\/dam\//i, weight: 'weak', field: 'html' },

  // Common SPA / JS platforms
  { platform: 'Next.js', type: 'header', re: /x-powered-by.*next\.js/i, weight: 'strong', field: 'headerValues' },
  { platform: 'Next.js', type: 'html', re: /id="__next"/i, weight: 'weak', field: 'html' },
  { platform: 'Shopify', type: 'header', re: /x-shopify-stage|x-sorting-hat/i, weight: 'strong', field: 'headerKeys' },
  { platform: 'Shopify', type: 'script', re: /cdn\.shopify\.com/i, weight: 'weak', field: 'html' },
  { platform: 'Wix', type: 'header', re: /x-wix-request-id/i, weight: 'strong', field: 'headerKeys' },
  { platform: 'Squarespace', type: 'html', re: /static\.squarespace\.com/i, weight: 'weak', field: 'html' },
  { platform: 'HubSpot CMS', type: 'script', re: /hs-scripts\.com|hubspot/i, weight: 'weak', field: 'html' },

  // Generic X-Powered-By (PHP/ASP.NET) — informational only.
  { platform: 'ASP.NET', type: 'header', re: /x-powered-by.*asp\.net/i, weight: 'weak', field: 'headerValues' },
  { platform: 'PHP', type: 'header', re: /x-powered-by.*php/i, weight: 'weak', field: 'headerValues' },
];

const CDN_RULES = [
  { name: 'Akamai', re: /akamai|x-akamai|on\.akamai\.net/i },
  { name: 'Fastly', re: /fastly/i },
  { name: 'Cloudflare', re: /cloudflare|cf-ray/i },
  { name: 'Azure Front Door', re: /azurefd|x-azure-ref/i },
  { name: 'Amazon CloudFront', re: /cloudfront/i },
];

export function detectTechnology({ headers = {}, cookies = [], html = '' }) {
  const headerKeys = Object.keys(headers).join('\n');
  const headerValues = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const cookieStr = cookies.join('\n');

  const fields = { headerKeys, headerValues, cookies: cookieStr, html };
  const tallies = new Map(); // platform -> { strong, weak, signals[] }

  for (const rule of RULES) {
    const haystack = fields[rule.field] || '';
    if (rule.re.test(haystack)) {
      const t = tallies.get(rule.platform) || { strong: 0, weak: 0, signals: [] };
      if (rule.weight === 'strong') t.strong += 1;
      else t.weak += 1;
      t.signals.push(`${rule.platform}:${rule.type}`);
      tallies.set(rule.platform, t);
    }
  }

  // CDN / hosting detection is supplementary, not a platform verdict.
  const cdns = [];
  const cdnHaystack = `${headerValues}\n${headerKeys}\n${html}`;
  for (const cdn of CDN_RULES) {
    if (cdn.re.test(cdnHaystack)) cdns.push(cdn.name);
  }

  if (tallies.size === 0) {
    return { platform: 'Unknown', confidence: 'unknown', signals: [], cdn: cdns };
  }

  // Pick the platform with the most signals, strong-weighted.
  let best = null;
  for (const [platform, t] of tallies) {
    const score = t.strong * 2 + t.weak;
    if (!best || score > best.score) best = { platform, score, ...t };
  }

  let confidence;
  const totalSignals = best.strong + best.weak;
  if (totalSignals >= 2) confidence = 'high';
  else if (best.strong >= 1) confidence = 'medium';
  else confidence = 'low';

  const allSignals = [];
  for (const t of tallies.values()) allSignals.push(...t.signals);

  return { platform: best.platform, confidence, signals: allSignals, cdn: cdns };
}
