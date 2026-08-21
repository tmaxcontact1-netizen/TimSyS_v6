CREATE TABLE IF NOT EXISTS programme_manager_responses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 publication_id INTEGER NOT NULL,
 publication_version INTEGER NOT NULL,
 source_channel TEXT NOT NULL CHECK(source_channel IN ('native','public_link','google_forms','csv')),
 source_record_key TEXT,
 respondent_role TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','flagged','withdrawn')),
 previous_status TEXT CHECK(previous_status IS NULL OR previous_status IN ('received','flagged')),
 identity_resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK(identity_resolution_status IN ('pending','matched','ambiguous','unresolved')),
 raw_identity_json TEXT NOT NULL DEFAULT '{}',
 answers_json TEXT NOT NULL DEFAULT '{}',
 raw_payload_json TEXT NOT NULL DEFAULT '{}',
 flags_json TEXT NOT NULL DEFAULT '[]',
 content_hash TEXT NOT NULL,
 amendment_token TEXT NOT NULL UNIQUE,
 priority_timestamp TEXT NOT NULL,
 source_submitted_at TEXT,
 submitted_at TEXT NOT NULL,
 revised_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 submitted_by TEXT NOT NULL,
 withdrawn_by TEXT,
 withdrawn_at TEXT,
 withdrawal_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(survey_id,source_channel,source_record_key),
 FOREIGN KEY(survey_id) REFERENCES programme_manager_surveys(id),
 FOREIGN KEY(publication_id) REFERENCES programme_manager_survey_publications(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_response_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 response_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(response_id) REFERENCES programme_manager_responses(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_responses_survey ON programme_manager_responses(app_id,survey_id,status,priority_timestamp,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_responses_resolution ON programme_manager_responses(app_id,programme_id,identity_resolution_status,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_response_audit ON programme_manager_response_audit(app_id,response_id,id DESC);
