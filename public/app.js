// Website Assessment Dashboard — frontend controller.

const SESSION_ID = (() => {
  const url = new URL(location.href);
  let s = url.searchParams.get('session');
  if (!s) {
    s = localStorage.getItem('wad_session') || `session-${Date.now()}`;
    localStorage.setItem('wad_session', s);
  }
  return s;
})();

const state = {
  accounts: [],
  sort: { key: 'revenue', dir: 'desc' },
  page: 1,
  pageSize: 25,
  filters: { search: '', industry: '', status: '', priority: '' },
};

const $ = (id) => document.getElementById(id);
const fmtRevenue = (n) => {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};
const scoreClass = (s) => (s == null ? '' : s <= 4 ? 'score-low' : s <= 6 ? 'score-mid' : 'score-high');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// --- Data loading ---------------------------------------------------------
async function loadAccounts() {
  const res = await fetch(`/api/sessions/${SESSION_ID}/accounts`);
  const data = await res.json();
  state.accounts = data.accounts;
  populateIndustryFilter();
  render();
}

async function loadCapability() {
  try {
    const h = await (await fetch('/api/health')).json();
    const parts = [`Model: ${h.model}`];
    if (!h.scoringConfigured) parts.push('⚠ no API key');
    parts.push(h.screenshotsEnabled ? 'screenshots on' : 'HTML-only');
    $('capability').textContent = parts.join(' · ');
  } catch { /* ignore */ }
}

// --- Filtering / sorting --------------------------------------------------
function filteredAccounts() {
  const f = state.filters;
  let rows = state.accounts.filter((a) => {
    if (f.search && !a.name.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.industry && a.industry !== f.industry) return false;
    if (f.status && a.status !== f.status) return false;
    if (f.priority && a.replatform_priority !== f.priority) return false;
    return true;
  });
  const { key, dir } = state.sort;
  rows.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (va == null) va = dir === 'asc' ? Infinity : -Infinity;
    if (vb == null) vb = dir === 'asc' ? Infinity : -Infinity;
    if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return dir === 'asc' ? va - vb : vb - va;
  });
  return rows;
}

function populateIndustryFilter() {
  const sel = $('industryFilter');
  const current = sel.value;
  const industries = [...new Set(state.accounts.map((a) => a.industry).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All industries</option>' +
    industries.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
  sel.value = current;
}

// --- Rendering ------------------------------------------------------------
function render() {
  renderStats();
  renderTable();
}

function renderStats() {
  const all = state.accounts;
  const assessed = all.filter((a) => a.overall_score != null);
  $('statTotal').textContent = all.length;
  $('statAssessed').textContent = assessed.length;
  $('statFlagged').textContent = all.filter((a) => a.replatform_priority === 'high').length;
  const avg = assessed.length
    ? (assessed.reduce((s, a) => s + a.overall_score, 0) / assessed.length).toFixed(1)
    : '—';
  $('statAvg').textContent = avg;

  // Platform breakdown bars.
  const counts = {};
  for (const a of assessed) {
    const p = a.platform_detected || 'Unknown';
    counts[p] = (counts[p] || 0) + 1;
  }
  const total = assessed.length || 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('platformBars').innerHTML = entries.map(([name, n]) => {
    const pct = Math.round((n / total) * 100);
    return `<div class="platform-bar"><span class="pname">${esc(name)}</span>
      <span class="bar" style="width:${Math.max(pct, 3)}%"></span><span>${pct}%</span></div>`;
  }).join('') || '<span class="muted" style="font-size:12px">No assessments yet</span>';
}

function renderTable() {
  const rows = filteredAccounts();
  const empty = $('emptyState');
  const table = $('accountTable');
  if (state.accounts.length === 0) {
    empty.classList.remove('hidden');
    table.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  table.classList.remove('hidden');

  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(start, start + state.pageSize);

  $('accountBody').innerHTML = pageRows.map((a) => `
    <tr data-id="${a.id}">
      <td class="acct-name">${esc(a.name)}</td>
      <td>${esc(a.industry || '—')}</td>
      <td class="num">${fmtRevenue(a.revenue)}</td>
      <td><span class="badge badge-${a.status}">${a.status}</span></td>
      <td class="num">${a.overall_score != null ? `<span class="score-pill ${scoreClass(a.overall_score)}">${a.overall_score}</span>` : '—'}</td>
      <td><button class="btn btn-sm" data-action="assess" data-id="${a.id}">${a.status === 'pending' ? 'Assess' : 'Re-assess'}</button></td>
    </tr>`).join('');

  $('pageInfo').textContent = `${state.page} / ${totalPages} · ${rows.length} accounts`;
  $('prevPage').disabled = state.page <= 1;
  $('nextPage').disabled = state.page >= totalPages;
}

// --- Detail panel ---------------------------------------------------------
async function openDetail(id) {
  const res = await fetch(`/api/accounts/${id}`);
  const { account, assessment } = await res.json();
  const a = assessment || {};
  const flags = Array.isArray(a.flags) ? a.flags : [];
  const hasShot = a.screenshot_desktop_path;

  $('detailContent').innerHTML = `
    <h2>${esc(account.name)}</h2>
    <div class="muted">${esc(account.industry || '—')} · ${fmtRevenue(account.revenue)}</div>
    ${account.resolved_url ? `<a class="detail-url" href="${esc(account.resolved_url)}" target="_blank" rel="noopener">${esc(account.resolved_url)}</a>` : ''}
    ${hasShot ? `<a href="/api/screenshots/${id}/desktop" target="_blank"><img class="detail-shot" src="/api/screenshots/${id}/desktop" alt="homepage screenshot" /></a>` : ''}
    ${assessment ? `
      <div class="score-grid">
        <div class="score-card"><div class="v ${scoreClass(a.usability_score)}">${a.usability_score ?? '—'}</div><div class="l">Usability</div></div>
        <div class="score-card"><div class="v ${scoreClass(a.look_feel_score)}">${a.look_feel_score ?? '—'}</div><div class="l">Look &amp; Feel</div></div>
        <div class="score-card"><div class="v ${scoreClass(a.overall_score)}">${a.overall_score ?? '—'}</div><div class="l">Overall</div></div>
      </div>
      <div class="detail-badges">
        <span class="badge badge-${account.status}">${account.status}</span>
        ${a.platform_detected ? `<span class="badge badge-modern">${esc(a.platform_detected)} · ${esc(a.platform_confidence || '')}</span>` : ''}
        ${a.age_feel ? `<span class="badge badge-pending">Age: ${esc(a.age_feel)}</span>` : ''}
        ${a.mobile_quality ? `<span class="badge badge-pending">Mobile: ${esc(a.mobile_quality)}</span>` : ''}
        ${a.replatform_priority ? `<span class="badge badge-flagged">Priority: ${esc(a.replatform_priority)}</span>` : ''}
      </div>
      <div class="detail-section"><h4>Usability notes</h4><p>${esc(a.usability_notes || '—')}</p></div>
      <div class="detail-section"><h4>Look &amp; feel notes</h4><p>${esc(a.look_feel_notes || '—')}</p></div>
      <div class="detail-section"><h4>SitecoreAI replatform case</h4><p>${esc(a.replatform_notes || '—')}</p></div>
      <div class="detail-section"><h4>Opportunity hook</h4>
        <div class="hook-box"><span id="hookText">${esc(a.opportunity_hook || '—')}</span>
          <button class="btn btn-sm" id="copyHook">Copy</button></div>
      </div>
      ${flags.length ? `<div class="detail-section"><h4>Flags</h4><div class="detail-badges">${flags.map((f) => `<span class="flag-chip">${esc(f)}</span>`).join('')}</div></div>` : ''}
    ` : `<p class="muted" style="margin-top:20px">${account.error ? 'Failed: ' + esc(account.error) : 'Not yet assessed.'}</p>`}
    <div class="detail-actions">
      <button class="btn btn-primary" data-action="assess" data-id="${id}">Re-assess (fresh fetch)</button>
    </div>`;

  $('detailPanel').classList.remove('hidden');
  $('panelScrim').classList.remove('hidden');

  const copyBtn = $('copyHook');
  if (copyBtn) copyBtn.onclick = () => {
    navigator.clipboard.writeText($('hookText').textContent);
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
  };
}

function closeDetail() {
  $('detailPanel').classList.add('hidden');
  $('panelScrim').classList.add('hidden');
}

// --- Actions --------------------------------------------------------------
async function assessOne(id) {
  await fetch(`/api/accounts/${id}/assess`, { method: 'POST' });
}

async function assessBatch(ids) {
  const body = ids ? { ids } : { onlyPending: true };
  await fetch(`/api/sessions/${SESSION_ID}/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function exportCsv() {
  const rows = filteredAccounts().filter((a) => a.overall_score != null);
  const usingFilter = state.filters.search || state.filters.industry || state.filters.status || state.filters.priority;
  let url = `/api/sessions/${SESSION_ID}/export.csv`;
  if (usingFilter) url += `?ids=${rows.map((r) => r.id).join(',')}`;
  window.location = url;
}

// --- Server-Sent Events ---------------------------------------------------
function connectEvents() {
  const es = new EventSource('/api/events');
  es.addEventListener('update', (e) => {
    const { accountId, status } = JSON.parse(e.data);
    const acct = state.accounts.find((a) => a.id === accountId);
    if (acct) {
      acct.status = status;
      // Pull fresh scores once an assessment finishes.
      if (['assessed', 'flagged', 'modern'].includes(status)) refreshAccount(accountId);
      else render();
    } else {
      loadAccounts();
    }
  });
  es.addEventListener('batch', (e) => {
    const { done, total, running } = JSON.parse(e.data);
    $('batchProgress').textContent = running ? `Assessing ${done}/${total}…` : (total ? `Done ${done}/${total}` : '');
    setBatchButtons(running);
    if (!running) setTimeout(() => ($('batchProgress').textContent = ''), 4000);
  });
  es.onerror = () => { /* EventSource auto-reconnects */ };
}

async function refreshAccount(id) {
  const res = await fetch(`/api/accounts/${id}`);
  const { account, assessment } = await res.json();
  const idx = state.accounts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    state.accounts[idx] = { ...account, ...(assessment || {}) };
    render();
  }
}

function setBatchButtons(running) {
  $('assessAllBtn').disabled = running;
  $('assessFilteredBtn').disabled = running;
}

// --- Event wiring ---------------------------------------------------------
function wire() {
  // Sorting.
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key, dir: key === 'name' || key === 'industry' ? 'asc' : 'desc' };
      render();
    });
  });

  // Filters.
  $('searchInput').addEventListener('input', (e) => { state.filters.search = e.target.value; state.page = 1; render(); });
  $('industryFilter').addEventListener('change', (e) => { state.filters.industry = e.target.value; state.page = 1; render(); });
  $('statusFilter').addEventListener('change', (e) => { state.filters.status = e.target.value; state.page = 1; render(); });
  $('priorityFilter').addEventListener('change', (e) => { state.filters.priority = e.target.value; state.page = 1; render(); });

  // Pagination.
  $('pageSize').addEventListener('change', (e) => { state.pageSize = Number(e.target.value); state.page = 1; render(); });
  $('prevPage').addEventListener('click', () => { state.page--; render(); });
  $('nextPage').addEventListener('click', () => { state.page++; render(); });

  // Table interactions (delegated).
  $('accountBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="assess"]');
    if (btn) {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const acct = state.accounts.find((a) => a.id === id);
      if (acct) { acct.status = 'fetching'; render(); }
      assessOne(id);
      return;
    }
    const row = e.target.closest('tr[data-id]');
    if (row) openDetail(Number(row.dataset.id));
  });

  // Detail panel re-assess (delegated).
  $('detailContent').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="assess"]');
    if (btn) { assessOne(Number(btn.dataset.id)); closeDetail(); }
  });

  $('detailClose').addEventListener('click', closeDetail);
  $('panelScrim').addEventListener('click', closeDetail);

  // Batch controls.
  $('assessAllBtn').addEventListener('click', () => { setBatchButtons(true); assessBatch(); });
  $('assessFilteredBtn').addEventListener('click', () => {
    const ids = filteredAccounts().map((a) => a.id);
    setBatchButtons(true);
    assessBatch(ids);
  });
  $('exportBtn').addEventListener('click', exportCsv);

  // Ingest modal.
  $('ingestBtn').addEventListener('click', () => $('ingestModal').classList.remove('hidden'));
  $('ingestCancel').addEventListener('click', () => $('ingestModal').classList.add('hidden'));
  $('ingestSubmit').addEventListener('click', submitIngest);
}

async function submitIngest() {
  const text = $('ingestText').value;
  const resEl = $('ingestResult');
  resEl.innerHTML = 'Importing…';
  const res = await fetch(`/api/sessions/${SESSION_ID}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (data.error) { resEl.innerHTML = `<span class="warn">${esc(data.error)}</span>`; return; }
  const parts = [`<span class="ok">Imported ${data.inserted} accounts.</span>`];
  if (data.duplicates?.length) parts.push(`<span class="warn">Skipped ${data.duplicates.length} duplicates.</span>`);
  if (data.errors?.length) parts.push(...data.errors.map((e) => `<span class="warn">${esc(e)}</span>`));
  resEl.innerHTML = parts.join('<br>');
  await loadAccounts();
  setTimeout(() => { $('ingestModal').classList.add('hidden'); $('ingestText').value = ''; resEl.innerHTML = ''; }, 1200);
}

// --- Boot -----------------------------------------------------------------
wire();
loadCapability();
loadAccounts();
connectEvents();
