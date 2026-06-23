import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databaseUrl), { recursive: true });

const db = new Database(config.databaseUrl);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL,
    name         TEXT NOT NULL,
    industry     TEXT,
    revenue      INTEGER,
    input_url    TEXT,
    resolved_url TEXT,
    final_url    TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    error        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    assessed_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
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
    flags                   TEXT,
    screenshot_desktop_path TEXT,
    screenshot_mobile_path  TEXT,
    fetch_duration_ms       INTEGER,
    score_duration_ms       INTEGER,
    raw_response            TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_accounts_session ON accounts(session_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_account ON assessments(account_id);
`);

const insertAccountStmt = db.prepare(`
  INSERT INTO accounts (session_id, name, industry, revenue, input_url, status)
  VALUES (@session_id, @name, @industry, @revenue, @input_url, 'pending')
`);

export function insertAccount(account) {
  const info = insertAccountStmt.run({
    session_id: account.session_id,
    name: account.name,
    industry: account.industry ?? null,
    revenue: account.revenue ?? null,
    input_url: account.input_url ?? null,
  });
  return info.lastInsertRowid;
}

export function getAccount(id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

export function listAccounts(sessionId) {
  return db.prepare(`
    SELECT a.*,
           s.usability_score, s.look_feel_score, s.overall_score,
           s.platform_detected, s.platform_confidence, s.age_feel,
           s.mobile_quality, s.replatform_priority, s.verdict,
           s.usability_notes, s.look_feel_notes, s.replatform_notes,
           s.opportunity_hook, s.flags,
           s.screenshot_desktop_path, s.screenshot_mobile_path
    FROM accounts a
    LEFT JOIN assessments s ON s.account_id = a.id
    WHERE a.session_id = ?
    ORDER BY a.revenue DESC, a.id ASC
  `).all(sessionId);
}

export function updateAccountStatus(id, status, fields = {}) {
  const sets = ['status = @status'];
  const params = { id, status };
  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = @${key}`);
    params[key] = value;
  }
  db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

const insertAssessmentStmt = db.prepare(`
  INSERT INTO assessments (
    account_id, platform_detected, platform_confidence,
    usability_score, look_feel_score, overall_score,
    age_feel, mobile_quality, replatform_priority, verdict,
    usability_notes, look_feel_notes, replatform_notes, opportunity_hook,
    flags, screenshot_desktop_path, screenshot_mobile_path,
    fetch_duration_ms, score_duration_ms, raw_response
  ) VALUES (
    @account_id, @platform_detected, @platform_confidence,
    @usability_score, @look_feel_score, @overall_score,
    @age_feel, @mobile_quality, @replatform_priority, @verdict,
    @usability_notes, @look_feel_notes, @replatform_notes, @opportunity_hook,
    @flags, @screenshot_desktop_path, @screenshot_mobile_path,
    @fetch_duration_ms, @score_duration_ms, @raw_response
  )
`);

export function saveAssessment(accountId, a) {
  // A re-assessment replaces the prior record for that account.
  db.prepare('DELETE FROM assessments WHERE account_id = ?').run(accountId);
  insertAssessmentStmt.run({
    account_id: accountId,
    platform_detected: a.platform_detected ?? null,
    platform_confidence: a.platform_confidence ?? null,
    usability_score: a.usability_score ?? null,
    look_feel_score: a.look_feel_score ?? null,
    overall_score: a.overall_score ?? null,
    age_feel: a.age_feel ?? null,
    mobile_quality: a.mobile_quality ?? null,
    replatform_priority: a.replatform_priority ?? null,
    verdict: a.verdict ?? null,
    usability_notes: a.usability_notes ?? null,
    look_feel_notes: a.look_feel_notes ?? null,
    replatform_notes: a.replatform_notes ?? null,
    opportunity_hook: a.opportunity_hook ?? null,
    flags: JSON.stringify(a.flags ?? []),
    screenshot_desktop_path: a.screenshot_desktop_path ?? null,
    screenshot_mobile_path: a.screenshot_mobile_path ?? null,
    fetch_duration_ms: a.fetch_duration_ms ?? null,
    score_duration_ms: a.score_duration_ms ?? null,
    raw_response: a.raw_response ? JSON.stringify(a.raw_response) : null,
  });
}

export function getAssessment(accountId) {
  return db.prepare('SELECT * FROM assessments WHERE account_id = ?').get(accountId);
}

export function findDuplicate(sessionId, name) {
  return db.prepare(
    'SELECT id FROM accounts WHERE session_id = ? AND lower(name) = lower(?)'
  ).get(sessionId, name);
}

export function listSessions() {
  return db.prepare(`
    SELECT session_id, COUNT(*) AS account_count, MAX(created_at) AS created_at
    FROM accounts GROUP BY session_id ORDER BY created_at DESC
  `).all();
}

export default db;
