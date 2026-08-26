-- Additive foundation only. The legacy medical_referrals table is intentionally
-- neither altered nor copied by this migration.
CREATE TABLE IF NOT EXISTS student_exit_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  movement_mode TEXT NOT NULL CHECK(movement_mode IN ('routine','destination_handoff','campus_release')),
  workflow_json TEXT NOT NULL,
  expected_duration_minutes INTEGER,
  operational_visibility TEXT NOT NULL DEFAULT 'standard' CHECK(operational_visibility IN ('standard','restricted')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,code)
);

CREATE TABLE IF NOT EXISTS student_exits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  student_id TEXT NOT NULL,
  exit_type_code TEXT NOT NULL,
  movement_mode TEXT NOT NULL CHECK(movement_mode IN ('routine','destination_handoff','campus_release')),
  status TEXT NOT NULL CHECK(status IN ('requested','approved','checked_out','received','returned','checked_in','closed','cancelled','denied','escalated')),
  operational_reason TEXT,
  restricted_reference_type TEXT,
  restricted_reference_id TEXT,
  origin_room_id TEXT,
  destination_room_id TEXT,
  released_by_staff_id TEXT,
  expected_return_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_exit_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  student_exit_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  operational_note TEXT,
  occurred_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(student_exit_id) REFERENCES student_exits(id)
);

CREATE TABLE IF NOT EXISTS student_exit_legacy_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  student_exit_id INTEGER NOT NULL,
  legacy_component TEXT NOT NULL CHECK(legacy_component IN ('medical_referrals')),
  legacy_record_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(student_exit_id) REFERENCES student_exits(id),
  UNIQUE(app_id,student_exit_id,legacy_component,legacy_record_id)
);

CREATE INDEX IF NOT EXISTS idx_student_exits_live ON student_exits(app_id,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_student_exits_student ON student_exits(app_id,student_id,created_at);
CREATE INDEX IF NOT EXISTS idx_student_exit_transitions_exit ON student_exit_transitions(app_id,student_exit_id,occurred_at);

INSERT OR IGNORE INTO student_exit_types(app_id,code,label,movement_mode,workflow_json,expected_duration_minutes,operational_visibility) VALUES
  ('principal-ed','bathroom','Bathroom','routine','{"start_status":"checked_out","states":["checked_out","returned","checked_in"]}',10,'standard'),
  ('principal-ed','medical','Medical / clinic','destination_handoff','{"start_status":"checked_out","states":["checked_out","received","returned","checked_in"]}',30,'restricted'),
  ('principal-ed','it_support','IT support','destination_handoff','{"start_status":"checked_out","states":["checked_out","received","returned","checked_in"]}',20,'standard'),
  ('principal-ed','counsellor','Counsellor','destination_handoff','{"start_status":"requested","states":["requested","approved","checked_out","received","returned","checked_in"]}',45,'restricted'),
  ('principal-ed','reception','Administration / reception','destination_handoff','{"start_status":"checked_out","states":["checked_out","received","returned","checked_in"]}',20,'standard'),
  ('principal-ed','campus_release','Campus release','campus_release','{"start_status":"requested","states":["requested","approved","checked_out","received","closed"]}',NULL,'restricted');
