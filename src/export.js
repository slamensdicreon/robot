/** CSV export matching the scoring schema fields (PRD 4.6). */

const COLUMNS = [
  'account_name',
  'industry',
  'revenue',
  'status',
  'resolved_url',
  'final_url',
  'platform_detected',
  'platform_confidence',
  'usability_score',
  'look_feel_score',
  'overall_score',
  'age_feel',
  'mobile_quality',
  'replatform_priority',
  'verdict',
  'usability_notes',
  'look_feel_notes',
  'replatform_notes',
  'opportunity_hook',
  'flags',
  'assessed_at',
];

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  const header = COLUMNS.join(',');
  const lines = rows.map((r) => {
    let flags = r.flags;
    if (typeof flags === 'string') {
      try {
        flags = JSON.parse(flags);
      } catch {
        /* leave as-is */
      }
    }
    const record = {
      account_name: r.name,
      industry: r.industry,
      revenue: r.revenue,
      status: r.status,
      resolved_url: r.resolved_url,
      final_url: r.final_url,
      platform_detected: r.platform_detected,
      platform_confidence: r.platform_confidence,
      usability_score: r.usability_score,
      look_feel_score: r.look_feel_score,
      overall_score: r.overall_score,
      age_feel: r.age_feel,
      mobile_quality: r.mobile_quality,
      replatform_priority: r.replatform_priority,
      verdict: r.verdict,
      usability_notes: r.usability_notes,
      look_feel_notes: r.look_feel_notes,
      replatform_notes: r.replatform_notes,
      opportunity_hook: r.opportunity_hook,
      flags: Array.isArray(flags) ? flags.join('; ') : flags,
      assessed_at: r.assessed_at,
    };
    return COLUMNS.map((c) => escapeCell(record[c])).join(',');
  });
  return [header, ...lines].join('\n');
}
