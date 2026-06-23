/**
 * Database dispatcher. Selects a backend from DATABASE_URL:
 *   postgres:// or postgresql://  → Neon serverless driver (Vercel)
 *   anything else (file path)     → better-sqlite3 (local dev)
 *
 * Both backends expose the same async interface so the rest of the app is
 * storage-agnostic. better-sqlite3 and playwright are optional dependencies,
 * so a Vercel build never needs to compile native SQLite bindings.
 */
import { config } from './config.js';

const isPostgres = /^postgres(ql)?:\/\//i.test(config.databaseUrl);

const backend = isPostgres
  ? await import('./db.postgres.js')
  : await import('./db.sqlite.js');

let schemaReady = null;
export function ensureSchema() {
  if (!schemaReady) schemaReady = backend.ensureSchema();
  return schemaReady;
}

export const driver = isPostgres ? 'postgres' : 'sqlite';

export const insertAccount = backend.insertAccount;
export const getAccount = backend.getAccount;
export const listAccounts = backend.listAccounts;
export const updateAccountStatus = backend.updateAccountStatus;
export const saveAssessment = backend.saveAssessment;
export const getAssessment = backend.getAssessment;
export const findDuplicate = backend.findDuplicate;
