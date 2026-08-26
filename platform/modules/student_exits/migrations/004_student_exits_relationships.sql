ALTER TABLE student_exits ADD COLUMN scheduler_placement_id TEXT;
ALTER TABLE student_exits ADD COLUMN teaching_group_ref TEXT;
ALTER TABLE student_exits ADD COLUMN source_context_type TEXT;
ALTER TABLE student_exits ADD COLUMN source_context_id TEXT;
CREATE TABLE IF NOT EXISTS student_exit_links (id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',student_exit_id INTEGER NOT NULL,link_component TEXT NOT NULL,link_type TEXT NOT NULL,record_id TEXT NOT NULL,visibility TEXT NOT NULL DEFAULT 'standard' CHECK(visibility IN ('standard','restricted')),metadata_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),FOREIGN KEY(student_exit_id) REFERENCES student_exits(id),UNIQUE(app_id,student_exit_id,link_component,link_type,record_id));
CREATE INDEX IF NOT EXISTS idx_student_exit_links_record ON student_exit_links(app_id,link_component,record_id);
CREATE INDEX IF NOT EXISTS idx_student_exit_schedule_context ON student_exits(app_id,scheduler_placement_id,teaching_group_ref);
