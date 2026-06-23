/**
 * Account ingestion (PRD 4.1).
 * Parses CSV / pasted-table text into account rows and deduplicates by name.
 */

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === '\t') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const HEADER_ALIASES = {
  name: ['account name', 'account', 'name', 'company', 'company name'],
  industry: ['industry', 'sector', 'vertical'],
  revenue: ['annual revenue', 'revenue', 'arr', 'annual_revenue'],
  input_url: ['website url', 'website', 'url', 'domain', 'known website url'],
  crm_id: ['crm account id', 'crm id', 'account id'],
  rep: ['assigned rep', 'rep', 'owner'],
  territory: ['territory', 'region'],
};

function mapHeaders(headerCells) {
  const map = {};
  headerCells.forEach((cell, idx) => {
    const lc = cell.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(lc)) map[field] = idx;
    }
  });
  return map;
}

function parseRevenue(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase().replace(/[$,\s]/g, '');
  let mult = 1;
  if (s.endsWith('b')) {
    mult = 1e9;
    s = s.slice(0, -1);
  } else if (s.endsWith('m')) {
    mult = 1e6;
    s = s.slice(0, -1);
  } else if (s.endsWith('k')) {
    mult = 1e3;
    s = s.slice(0, -1);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

const MAX_BATCH = 500;

/**
 * @returns { accounts[], duplicates[], errors[], truncated }
 */
export function parseAccounts(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { accounts: [], duplicates: [], errors: ['Empty input'], truncated: false };

  const headerCells = parseCsvLine(lines[0]);
  const headerMap = mapHeaders(headerCells);
  const errors = [];

  if (headerMap.name === undefined) {
    return { accounts: [], duplicates: [], errors: ['Could not find an "Account Name" column'], truncated: false };
  }

  const seen = new Set();
  const accounts = [];
  const duplicates = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const name = (cells[headerMap.name] || '').trim();
    if (!name) {
      errors.push(`Row ${i + 1}: missing account name, skipped`);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(name);
      continue;
    }
    seen.add(key);

    accounts.push({
      name,
      industry: headerMap.industry !== undefined ? cells[headerMap.industry] || null : null,
      revenue: headerMap.revenue !== undefined ? parseRevenue(cells[headerMap.revenue]) : null,
      input_url: headerMap.input_url !== undefined ? cells[headerMap.input_url] || null : null,
    });
  }

  let truncated = false;
  if (accounts.length > MAX_BATCH) {
    accounts.length = MAX_BATCH;
    truncated = true;
    errors.push(`Batch exceeds ${MAX_BATCH} accounts; truncated. Split larger lists across sessions.`);
  }

  return { accounts, duplicates, errors, truncated };
}
