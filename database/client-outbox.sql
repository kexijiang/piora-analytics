-- Mirrors desktop/src/analytics-store.mts in Piora. Credentials live in a DPAPI file, never in this DB.
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 1000;
CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE outbox (
  event_id TEXT PRIMARY KEY,
  event_seq INTEGER UNIQUE NOT NULL,
  source_key TEXT UNIQUE NOT NULL,
  json TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE receipts (
  source_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE quarantine (event_id TEXT PRIMARY KEY, code TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE pending (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
-- state contains JSON: installation_id, next_seq (decimal string), enabled_at,
-- policy, app_launch_id, file_salt, next_due_at, clock_offset_ms, journal mtimes,
-- health counters and pending health ACK watermark. Millisecond times are local epoch.
-- receipts also retain suppressed source keys while collection is paused.
