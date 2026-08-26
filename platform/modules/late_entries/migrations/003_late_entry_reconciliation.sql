CREATE TABLE IF NOT EXISTS late_entry_reconciliation_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',late_entry_id INTEGER NOT NULL,policy_version_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','applied','rejected','stale','blocked')),proposal_json TEXT NOT NULL,blockers_json TEXT NOT NULL DEFAULT '[]',
 proposed_by TEXT NOT NULL,proposed_at TEXT NOT NULL DEFAULT(datetime('now')),decided_by TEXT,decision_reason TEXT,decided_at TEXT,
 FOREIGN KEY(late_entry_id) REFERENCES late_entries(id),FOREIGN KEY(policy_version_id) REFERENCES late_entry_policy_versions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_current_late_reconciliation ON late_entry_reconciliation_runs(app_id,late_entry_id) WHERE status='proposed';
CREATE TABLE IF NOT EXISTS late_entry_attendance_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',late_entry_id INTEGER NOT NULL,reconciliation_run_id INTEGER NOT NULL,
 authority TEXT NOT NULL CHECK(authority IN ('attendance','classroom_attendance')),target_session_id INTEGER,target_record_id INTEGER,scheduler_placement_id INTEGER,
 before_json TEXT,after_json TEXT NOT NULL,applied_by TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(late_entry_id) REFERENCES late_entries(id),FOREIGN KEY(reconciliation_run_id) REFERENCES late_entry_reconciliation_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_late_attendance_links ON late_entry_attendance_links(app_id,late_entry_id,authority);
