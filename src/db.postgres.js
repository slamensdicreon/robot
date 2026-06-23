/**
 * Vercel backend: Postgres via the Neon serverless HTTP driver.
 * Works with Vercel Postgres, Neon, or any Neon-compatible connection string.
 * Uses one-shot HTTP queries (no pooling) so it is safe in serverless functions.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { config } from './config.js';

// Neon's Pool talks over WebSocket; use the runtime's global one (Node 20+ and
// the Vercel Node runtime both provide it). A single module-level pool is
// reused across warm serverless invocations.
if (typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const pool = new Pool({ connectionString: config.databaseUrl });

// node-postgres returns { rows }; normalize to the rows array.
async function sqlQuery(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}
const sql = { query: sqlQuery };

export async function ensureSchema() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id           SERIAL PRIMARY KEY,
      session_id   TEXT NOT NULL,
      name         TEXT NOT NULL,
      industry     TEXT,
      revenue      BIGINT,
      input_url    TEXT,
      resolved_url TEXT,
      final_url    TEXT,
      status       TEXT NOT NULL DEFAULT 'pending',
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      assessed_at  TIMESTAMPTZ
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id                      SERIAL PRIMARY KEY,
      account_id              INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      platform_detected       TEXT,
      platform_confidence     TEXT,
      usability_score         INTEGER,
      look_feel_score         INTEGER,
      overall_score           INTEGER,
      age_feel                TEXT,
      mobile_quality          TEXT,
      replatform_priority     TEXT,
      verdict                 TEXT,
      usability_notes         TEXT,
      look_feel_notes         TEXT,
      replatform_notes        TEXT,
      opportunity_hook        TEXT,
      flags                   JSONB,
      screenshot_desktop_path TEXT,
      screenshot_mobile_path  TEXT,
      fetch_duration_ms       INTEGER,
      score_duration_ms       INTEGER,
      raw_response            JSONB,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await sql.query('CREATE INDEX IF NOT EXISTS idx_accounts_session ON accounts(session_id)');
  await sql.query('CREATE INDEX IF NOT EXISTS idx_assessments_account ON assessments(account_id)');
}

export async function insertAccount(account) {
  const rows = await sql.query(
    `INSERT INTO accounts (session_id, name, industry, revenue, input_url, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
    [account.session_id, account.name, account.industry ?? null,
     account.revenue ?? null, account.input_url ?? null]
  );
  return rows[0].id;
}

export async function getAccount(id) {
  const rows = await sql.query('SELECT * FROM accounts WHERE id = $1', [id]);
  return rows[0];
}

export async function listAccounts(sessionId) {
  return sql.query(`
    SELECT a.*,
           s.usability_score, s.look_feel_score, s.overall_score,
           s.platform_detected, s.platform_confidence, s.age_feel,
           s.mobile_quality, s.replatform_priority, s.verdict,
           s.usability_notes, s.look_feel_notes, s.replatform_notes,
           s.opportunity_hook, s.flags,
           s.screenshot_desktop_path, s.screenshot_mobile_path
    FROM accounts a
    LEFT JOIN assessments s ON s.account_id = a.id
    WHERE a.session_id = $1
    ORDER BY a.revenue DESC NULLS LAST, a.id ASC
  `, [sessionId]);
}

export async function updateAccountStatus(id, status, fields = {}) {
  const sets = ['status = $1'];
  const params = [status];
  let i = 2;
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    params.push(value);
    i += 1;
  }
  params.push(id);
  await sql.query(`UPDATE accounts SET ${sets.join(', ')} WHERE id = $${i}`, params);
}

export async function saveAssessment(accountId, a) {
  await sql.query('DELETE FROM assessments WHERE account_id = $1', [accountId]);
  await sql.query(`
    INSERT INTO assessments (
      account_id, platform_detected, platform_confidence,
      usability_score, look_feel_score, overall_score,
      age_feel, mobile_quality, replatform_priority, verdict,
      usability_notes, look_feel_notes, replatform_notes, opportunity_hook,
      flags, screenshot_desktop_path, screenshot_mobile_path,
      fetch_duration_ms, score_duration_ms, raw_response
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    )`,
    [
      accountId, a.platform_detected ?? null, a.platform_confidence ?? null,
      a.usability_score ?? null, a.look_feel_score ?? null, a.overall_score ?? null,
      a.age_feel ?? null, a.mobile_quality ?? null, a.replatform_priority ?? null, a.verdict ?? null,
      a.usability_notes ?? null, a.look_feel_notes ?? null, a.replatform_notes ?? null, a.opportunity_hook ?? null,
      JSON.stringify(a.flags ?? []), a.screenshot_desktop_path ?? null, a.screenshot_mobile_path ?? null,
      a.fetch_duration_ms ?? null, a.score_duration_ms ?? null,
      a.raw_response ? JSON.stringify(a.raw_response) : null,
    ]
  );
}

export async function getAssessment(accountId) {
  const rows = await sql.query('SELECT * FROM assessments WHERE account_id = $1', [accountId]);
  return rows[0];
}

export async function findDuplicate(sessionId, name) {
  const rows = await sql.query(
    'SELECT id FROM accounts WHERE session_id = $1 AND lower(name) = lower($2)',
    [sessionId, name]
  );
  return rows[0];
}
