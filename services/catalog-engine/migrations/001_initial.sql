PRAGMA foreign_keys = ON;

CREATE TABLE operational_cases (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  version INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  parties_json TEXT NOT NULL,
  shipment_json TEXT NOT NULL,
  products_json TEXT NOT NULL,
  operational_metrics_json TEXT NOT NULL,
  readiness_json TEXT,
  decision_json TEXT,
  catalog_governance_json TEXT,
  divergences_json TEXT NOT NULL,
  missing_fields_json TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  decisions_json TEXT NOT NULL,
  resolved_fields_json TEXT NOT NULL,
  quantitative_prediction_json TEXT NOT NULL,
  product_identities_json TEXT NOT NULL,
  idempotency_keys_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_analyzed_at TEXT
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operational_cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source_format TEXT,
  source_method TEXT,
  file_name TEXT,
  external_id TEXT,
  content_hash TEXT,
  storage_key TEXT,
  status TEXT NOT NULL DEFAULT 'INGESTED',
  ingested_at TEXT,
  canonical_json TEXT NOT NULL
);

CREATE TABLE evidences (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operational_cases(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  status TEXT NOT NULL,
  value_json TEXT,
  normalized_value_json TEXT,
  raw_value_json TEXT,
  source_json TEXT NOT NULL,
  confidence TEXT NOT NULL,
  extraction_json TEXT,
  extracted_at TEXT NOT NULL,
  supersedes_id TEXT,
  evidence_json TEXT NOT NULL
);

CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operational_cases(id) ON DELETE CASCADE,
  finding_key TEXT NOT NULL,
  type TEXT NOT NULL,
  field TEXT,
  severity TEXT NOT NULL,
  blocking INTEGER NOT NULL,
  status TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  dismissed_at TEXT,
  resolution_reason TEXT,
  version INTEGER NOT NULL,
  finding_json TEXT NOT NULL,
  UNIQUE(case_id, finding_key)
);

CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operational_cases(id) ON DELETE CASCADE,
  finding_id TEXT NOT NULL,
  action_key TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assigned_role TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  version INTEGER NOT NULL,
  action_json TEXT NOT NULL,
  UNIQUE(case_id, action_key)
);

CREATE TABLE timeline_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES operational_cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  case_version INTEGER NOT NULL,
  event_json TEXT NOT NULL
);

CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_documents_hash ON documents(case_id, content_hash);
CREATE INDEX idx_evidences_case_id ON evidences(case_id);
CREATE INDEX idx_findings_case_id ON findings(case_id);
CREATE INDEX idx_actions_case_id ON actions(case_id);
CREATE INDEX idx_actions_finding_id ON actions(finding_id);
CREATE INDEX idx_timeline_case_time ON timeline_events(case_id, timestamp, event_id);
