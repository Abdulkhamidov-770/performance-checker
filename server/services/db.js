/**
 * SQLite database service — better-sqlite3 sinxron API.
 * Schema fayldan o'qiladi, idempotent yaratiladi.
 */
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(__dirname, '../../.perf-data/perf-checker.db');
const SCHEMA_PATH = resolve(__dirname, '../db/schema.sql');

let dbInstance = null;

export function getDB(customPath) {
  if (dbInstance) return dbInstance;
  const dbPath = customPath || process.env.PERF_DB || DEFAULT_DB_PATH;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  dbInstance = db;
  return db;
}

export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
