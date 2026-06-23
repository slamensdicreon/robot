import Anthropic from '@anthropic-ai/sdk';
import { config, assertScoringConfigured } from './config.js';

let client = null;
function getClient() {
  if (!client) {
    assertScoringConfigured();
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a senior digital experience consultant at Icreon, a Sitecore implementation partner. You assess prospect company websites for replatform opportunity.

Apply this rubric to each dimension on a 1–10 scale:
- Usability (1–3: confusing nav, broken elements, no clear CTA | 4–6: functional but friction-heavy | 7–9: clear IA, fast task completion | 10: exemplary)
- Look & Feel (1–3: visually dated, inconsistent, low-production | 4–6: competent but generic | 7–9: polished, brand-consistent | 10: distinctive and memorable)
- Overall (1–3: urgent replatform need | 4–6: meaningful improvement opportunity | 7–9: solid but upgradeable | 10: no near-term opportunity)

Ground every judgment in the supplied screenshot and extracted signals — never in prior knowledge of the brand. If a screenshot is absent, score conservatively from the HTML signals and say so in the notes.

The "verdict" must be: "flagged" (overall <= 5, clear replatform case), "modern" (overall >= 8, already on a current stack), or "assessed" (everything in between).

Respond with ONLY a single valid JSON object, no prose, no markdown fences.`;

function buildUserText(input) {
  const { account, fetchResult } = input;
  const ex = fetchResult.extracted || {};
  const tech = fetchResult.technology || {};
  return [
    `Account: ${account.name}`,
    `Industry: ${account.industry || 'unknown'}`,
    `Annual revenue (USD): ${account.revenue ?? 'unknown'}`,
    `Resolved URL: ${account.resolved_url}`,
    `Final URL after redirects: ${fetchResult.finalUrl}`,
    '',
    `Page title: ${ex.title || '(none)'}`,
    `Meta description: ${ex.metaDescription || '(none)'}`,
    `H1: ${(ex.headings?.h1 || []).join(' | ') || '(none)'}`,
    `H2: ${(ex.headings?.h2 || []).slice(0, 10).join(' | ') || '(none)'}`,
    `Navigation labels: ${(ex.nav || []).join(', ') || '(none)'}`,
    `Footer links: ${(ex.footerLinks || []).slice(0, 15).join(', ') || '(none)'}`,
    `Detected platform: ${tech.platform || 'Unknown'} (confidence: ${tech.confidence || 'unknown'})`,
    `Tech signals: ${(tech.signals || []).join(', ') || '(none)'}`,
    `CDN/hosting: ${(tech.cdn || []).join(', ') || '(none)'}`,
    `Has viewport meta: ${ex.hasViewportMeta}`,
    `Mobile responsiveness: ${fetchResult.mobileResponsive || 'unknown'}`,
    `Copyright year on page: ${ex.copyrightYear || 'unknown'}`,
    `Pre-computed flags: ${(fetchResult.flags || []).join(', ') || '(none)'}`,
    '',
    'Return the JSON object with fields: usability_score, look_feel_score, overall_score, platform_confirmed, platform_confidence (high|medium|low), age_feel (dated|mixed|modern), mobile_quality (poor|acceptable|good), replatform_priority (high|medium|low), verdict (flagged|assessed|modern), usability_notes, look_feel_notes, replatform_notes (the SitecoreAI replatform case), opportunity_hook (1 sentence), flags (array from: no_ssl, slow_load, broken_nav, no_mobile, outdated_copyright).',
  ].join('\n');
}

function parseJson(text) {
  // Strip accidental markdown fences, then take the first {...} block.
  const cleaned = text.replace(/```json\s*|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const clampScore = (n) => Math.max(1, Math.min(10, Math.round(Number(n) || 0))) || null;

/** Score one account from its fetch result (PRD 4.4). Retries on rate limits. */
export async function scoreAccount(input, { maxRetries = 4 } = {}) {
  const started = Date.now();
  const content = [{ type: 'text', text: buildUserText(input) }];

  const b64 = input.fetchResult?.screenshots?.desktopBase64;
  if (b64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: b64 },
    });
  }

  let attempt = 0;
  for (;;) {
    try {
      const msg = await getClient().messages.create({
        model: config.scoreModel,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      });
      const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
      const parsed = parseJson(text);

      // Merge model flags with deterministically detected ones.
      const flags = [...new Set([...(input.fetchResult.flags || []), ...(parsed.flags || [])])];

      return {
        platform_detected: parsed.platform_confirmed || input.fetchResult.technology?.platform,
        platform_confidence: parsed.platform_confidence || input.fetchResult.technology?.confidence,
        usability_score: clampScore(parsed.usability_score),
        look_feel_score: clampScore(parsed.look_feel_score),
        overall_score: clampScore(parsed.overall_score),
        age_feel: parsed.age_feel,
        mobile_quality: parsed.mobile_quality,
        replatform_priority: parsed.replatform_priority,
        verdict: parsed.verdict,
        usability_notes: parsed.usability_notes,
        look_feel_notes: parsed.look_feel_notes,
        replatform_notes: parsed.replatform_notes,
        opportunity_hook: parsed.opportunity_hook,
        flags,
        score_duration_ms: Date.now() - started,
        raw_response: parsed,
      };
    } catch (err) {
      const status = err?.status;
      const retryable = status === 429 || status === 529 || (status >= 500 && status < 600);
      if (retryable && attempt < maxRetries) {
        const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}
