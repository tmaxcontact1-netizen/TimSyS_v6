CREATE TABLE IF NOT EXISTS late_entry_schedule_contexts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',late_entry_id INTEGER,
 student_id TEXT NOT NULL,arrival_at TEXT NOT NULL,resolution_status TEXT NOT NULL CHECK(resolution_status IN ('resolved','ambiguous','unresolved')),
 resolution_code TEXT NOT NULL,academic_year_id INTEGER,scheduler_setup_id INTEGER,schedule_version_id INTEGER,cycle_week INTEGER,day_index INTEGER,
 school_start_time TEXT,current_placement_id INTEGER,current_teaching_group_ref TEXT,current_period_start TEXT,current_period_end TEXT,
 missed_placement_ids_json TEXT NOT NULL DEFAULT '[]',candidate_placement_ids_json TEXT NOT NULL DEFAULT '[]',evidence_json TEXT NOT NULL DEFAULT '{}',
 resolved_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),FOREIGN KEY(late_entry_id) REFERENCES late_entries(id),FOREIGN KEY(academic_year_id) REFERENCES academic_years(id),
 FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),FOREIGN KEY(schedule_version_id) REFERENCES scheduler_versions(id),FOREIGN KEY(current_placement_id) REFERENCES scheduler_placements(id)
);
CREATE TABLE IF NOT EXISTS late_entry_exceptions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',late_entry_id INTEGER,code TEXT NOT NULL,summary TEXT NOT NULL,evidence_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),raised_by TEXT NOT NULL,raised_at TEXT NOT NULL DEFAULT(datetime('now')),resolved_by TEXT,resolution TEXT,resolved_at TEXT,
 FOREIGN KEY(late_entry_id) REFERENCES late_entries(id)
);
CREATE INDEX IF NOT EXISTS idx_late_context_student_time ON late_entry_schedule_contexts(app_id,student_id,arrival_at);
CREATE INDEX IF NOT EXISTS idx_late_exception_open ON late_entry_exceptions(app_id,status,raised_at);
