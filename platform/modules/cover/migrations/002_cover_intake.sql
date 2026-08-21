CREATE TABLE IF NOT EXISTS cover_absences (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, external_key TEXT NOT NULL, staff_id TEXT NOT NULL,
 absence_type TEXT NOT NULL CHECK(absence_type IN ('full_day','partial_day','multi_day','open_ended')),
 starts_at TEXT NOT NULL, ends_at TEXT, category TEXT NOT NULL DEFAULT 'unspecified', operational_note TEXT,
 source TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported','confirmed','cancelled','closed')),
 revision INTEGER NOT NULL DEFAULT 1, cancellation_reason TEXT, created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,external_key), CHECK(ends_at IS NULL OR starts_at<ends_at)
);
CREATE TABLE IF NOT EXISTS cover_demands (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, external_key TEXT NOT NULL, absence_id INTEGER,
 source_type TEXT NOT NULL CHECK(source_type IN ('scheduled_lesson','manual')), source_ref TEXT,
 scheduled_lesson_ref TEXT, teaching_group_ref TEXT, absent_staff_id TEXT, title TEXT NOT NULL,
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, location_ref TEXT, subject_ref TEXT,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','cancelled','filled','closed')), revision INTEGER NOT NULL DEFAULT 1,
 cancellation_reason TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,external_key), FOREIGN KEY(absence_id) REFERENCES cover_absences(id), CHECK(starts_at<ends_at)
);
CREATE TABLE IF NOT EXISTS cover_intake_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, entity_type TEXT NOT NULL CHECK(entity_type IN ('absence','demand')),
 entity_id INTEGER NOT NULL, action TEXT NOT NULL, reason TEXT, snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cover_absence_window ON cover_absences(app_id,staff_id,status,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_cover_demand_window ON cover_demands(app_id,status,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS idx_cover_demand_absence ON cover_demands(app_id,absence_id,status);
