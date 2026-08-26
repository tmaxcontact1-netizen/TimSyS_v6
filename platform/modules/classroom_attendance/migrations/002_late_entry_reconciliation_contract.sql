ALTER TABLE class_attendance_sessions ADD COLUMN scheduler_placement_id INTEGER;
ALTER TABLE class_attendance_sessions ADD COLUMN source_component TEXT;
ALTER TABLE class_attendance_sessions ADD COLUMN source_record_id TEXT;
ALTER TABLE class_attendance_marks ADD COLUMN source_component TEXT;
ALTER TABLE class_attendance_marks ADD COLUMN source_record_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_attendance_scheduler_session ON class_attendance_sessions(gradebook_id,session_date,scheduler_placement_id) WHERE scheduler_placement_id IS NOT NULL AND status!='withdrawn';
CREATE INDEX IF NOT EXISTS idx_class_attendance_source ON class_attendance_marks(source_component,source_record_id);
