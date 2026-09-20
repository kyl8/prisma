CREATE TRIGGER prevent_evidence_update
BEFORE UPDATE ON evidences
BEGIN
  SELECT RAISE(ABORT, 'Evidence records are immutable');
END;

CREATE TRIGGER prevent_evidence_delete
BEFORE DELETE ON evidences
BEGIN
  SELECT RAISE(ABORT, 'Evidence records are immutable');
END;

CREATE TRIGGER prevent_timeline_update
BEFORE UPDATE ON timeline_events
BEGIN
  SELECT RAISE(ABORT, 'Timeline events are immutable');
END;

CREATE TRIGGER prevent_timeline_delete
BEFORE DELETE ON timeline_events
BEGIN
  SELECT RAISE(ABORT, 'Timeline events are immutable');
END;

CREATE UNIQUE INDEX idx_documents_external_id
  ON documents(case_id, external_id)
  WHERE external_id IS NOT NULL;
