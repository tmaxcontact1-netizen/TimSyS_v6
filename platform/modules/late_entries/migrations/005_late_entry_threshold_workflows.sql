CREATE TABLE IF NOT EXISTS late_entry_threshold_definitions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',policy_version_id INTEGER NOT NULL,scope_type TEXT NOT NULL CHECK(scope_type IN ('school','class')),
 threshold_count INTEGER NOT NULL CHECK(threshold_count>0),label TEXT NOT NULL,recommended_actions_json TEXT NOT NULL DEFAULT '[]',severity TEXT NOT NULL DEFAULT 'information' CHECK(severity IN ('information','warning','critical')),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,policy_version_id,scope_type,threshold_count),FOREIGN KEY(policy_version_id) REFERENCES late_entry_policy_versions(id)
);
CREATE TABLE IF NOT EXISTS late_entry_threshold_cases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',student_id TEXT NOT NULL,scope_type TEXT NOT NULL CHECK(scope_type IN ('school','class')),scope_ref TEXT NOT NULL,
 period_start TEXT NOT NULL,period_end TEXT NOT NULL,policy_version_id INTEGER NOT NULL,threshold_definition_id INTEGER NOT NULL,observed_count INTEGER NOT NULL,occurrence_ids_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'recommended' CHECK(status IN ('recommended','approved','modified','dismissed','completed')),recommendation_json TEXT NOT NULL,decision_json TEXT,
 generated_at TEXT NOT NULL DEFAULT(datetime('now')),decided_by TEXT,decided_at TEXT,decision_reason TEXT,completed_at TEXT,
 UNIQUE(app_id,student_id,scope_type,scope_ref,period_start,period_end,threshold_definition_id),FOREIGN KEY(policy_version_id) REFERENCES late_entry_policy_versions(id),FOREIGN KEY(threshold_definition_id) REFERENCES late_entry_threshold_definitions(id)
);
CREATE TABLE IF NOT EXISTS late_entry_threshold_actions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',threshold_case_id INTEGER NOT NULL,action_type TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('approved','created','dispatched','completed','failed','dismissed')),
 action_json TEXT NOT NULL,communication_id INTEGER,actor_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(threshold_case_id) REFERENCES late_entry_threshold_cases(id),FOREIGN KEY(communication_id) REFERENCES communications(id)
);
CREATE INDEX IF NOT EXISTS idx_late_threshold_cases ON late_entry_threshold_cases(app_id,student_id,status,generated_at);
