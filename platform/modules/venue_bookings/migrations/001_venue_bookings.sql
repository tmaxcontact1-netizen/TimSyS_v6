CREATE TABLE IF NOT EXISTS venue_bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', room_id INTEGER NOT NULL,
 subject_component TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, title TEXT NOT NULL,
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, expected_attendance INTEGER, setup_notes TEXT,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','completed','cancelled','withdrawn')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_window ON venue_bookings(app_id,room_id,starts_at,ends_at,status);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_subject ON venue_bookings(app_id,subject_component,subject_type,subject_id);
