CREATE INDEX IF NOT EXISTS researched_audit_study_time_idx ON researched.audit_events(study_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS researched_evidence_status_idx ON researched.evidence_items(study_id,status,created_at DESC);
