-- Performance Checker UI — SQLite schema
-- Tarix: projects, scans (joblar), snapshots (har skan natijasi), settings.

CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,
  framework       TEXT,                -- 'vue' | 'react' | 'auto'
  url             TEXT,                -- runtime uchun
  scenario        TEXT DEFAULT 'desktop',
  chrome_profile  TEXT,                -- 'Default' | 'Profile 1' | NULL
  user_data_dir   TEXT,                -- agar custom bo'lsa
  notes           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id              TEXT PRIMARY KEY,    -- nanoid
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layers          TEXT NOT NULL,       -- JSON: ["static","runtime","ai"]
  scenario        TEXT,
  runs            INTEGER DEFAULT 3,
  status          TEXT NOT NULL,       -- 'queued'|'running'|'completed'|'failed'|'cancelled'
  exit_code       INTEGER,
  error_message   TEXT,
  log_path        TEXT,                -- to'liq log fayl yo'li
  report_dir      TEXT,                -- HTML/JSON hisobotlar papkasi
  result_summary  TEXT,                -- JSON: {findings:{critical,warning,info}, lighthouse, lcp,...}
  started_at      INTEGER,
  finished_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scans_project ON scans(project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scan_id         TEXT REFERENCES scans(id) ON DELETE SET NULL,
  taken_at        INTEGER NOT NULL,
  lighthouse      REAL,                -- 0..100
  lcp             REAL,                -- ms
  inp             REAL,
  cls             REAL,
  tbt             REAL,
  total_kb        REAL,
  critical_count  INTEGER,
  warning_count   INTEGER,
  info_count      INTEGER,
  regression      INTEGER DEFAULT 0    -- 0/1 flag
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key             TEXT PRIMARY KEY,
  value           TEXT,
  encrypted       INTEGER DEFAULT 0,
  updated_at      INTEGER NOT NULL
);
