CREATE TABLE IF NOT EXISTS class_attendance_sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,gradebook_id INTEGER NOT NULL,session_date TEXT NOT NULL,title TEXT,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','withdrawn')),created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id),UNIQUE(gradebook_id,session_date,title)
);
CREATE TABLE IF NOT EXISTS class_attendance_marks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,session_id INTEGER NOT NULL,student_id TEXT NOT NULL,
 attendance_status TEXT NOT NULL CHECK(attendance_status IN ('present','absent','late','excused','unrecorded')),
 minutes_late INTEGER NOT NULL DEFAULT 0,notes TEXT,recorded_by TEXT NOT NULL,
 supersedes_id INTEGER,superseded_by_id INTEGER,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded')),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),FOREIGN KEY(session_id) REFERENCES class_attendance_sessions(id),
 FOREIGN KEY(supersedes_id) REFERENCES class_attendance_marks(id),FOREIGN KEY(superseded_by_id) REFERENCES class_attendance_marks(id)
);
CREATE UNIQUE INDEX uq_current_class_attendance_mark ON class_attendance_marks(session_id,student_id) WHERE status='active';
CREATE INDEX idx_class_attendance_student ON class_attendance_marks(student_id,status);
