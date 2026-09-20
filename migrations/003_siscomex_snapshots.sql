ALTER TABLE operational_cases
  ADD COLUMN siscomex_state_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE siscomex_snapshots (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES operational_cases(id),
  product_id TEXT,
  subsystem TEXT NOT NULL,
  environment TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  external_product_code TEXT,
  external_version TEXT,
  foreign_operator_code TEXT,
  ncm TEXT,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_siscomex_snapshot_identity
  ON siscomex_snapshots (
    environment,
    subsystem,
    resource_type,
    resource_key,
    payload_hash,
    COALESCE(case_id, ''),
    COALESCE(product_id, '')
  );

CREATE INDEX idx_siscomex_snapshot_case
  ON siscomex_snapshots(case_id, product_id, fetched_at DESC);

CREATE INDEX idx_siscomex_snapshot_resource
  ON siscomex_snapshots(environment, subsystem, resource_type, resource_key, fetched_at DESC);

CREATE TRIGGER prevent_siscomex_snapshot_update
BEFORE UPDATE ON siscomex_snapshots
BEGIN
  SELECT RAISE(ABORT, 'Siscomex snapshots are immutable');
END;

CREATE TRIGGER prevent_siscomex_snapshot_delete
BEFORE DELETE ON siscomex_snapshots
BEGIN
  SELECT RAISE(ABORT, 'Siscomex snapshots are immutable');
END;

CREATE TABLE siscomex_cache_entries (
  scope_key TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES siscomex_snapshots(id),
  checked_at TEXT NOT NULL
);

CREATE TABLE siscomex_sync_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES operational_cases(id),
  product_id TEXT,
  sync_type TEXT NOT NULL,
  environment TEXT NOT NULL,
  status TEXT NOT NULL,
  resource_count INTEGER NOT NULL,
  cache_status TEXT NOT NULL,
  error_code TEXT,
  error_tag TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE INDEX idx_siscomex_sync_case
  ON siscomex_sync_runs(case_id, product_id, started_at DESC);
