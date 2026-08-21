CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', code TEXT NOT NULL, name TEXT NOT NULL,
  starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','closed','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, code), CHECK(starts_on < ends_on)
);
CREATE TABLE IF NOT EXISTS academic_programmes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', code TEXT NOT NULL, name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, code)
);
CREATE TABLE IF NOT EXISTS academic_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', code TEXT NOT NULL, name TEXT NOT NULL,
  programme_id INTEGER, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, code), FOREIGN KEY(programme_id) REFERENCES academic_programmes(id)
);
CREATE TABLE IF NOT EXISTS reporting_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', academic_year_id INTEGER NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'school' CHECK(scope_type IN ('school','programme','course','gradebook')),
  scope_id TEXT NOT NULL DEFAULT 'default', code TEXT NOT NULL, name TEXT NOT NULL,
  starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 1,
  credit_fraction REAL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','closed','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, academic_year_id, scope_type, scope_id, code),
  FOREIGN KEY(academic_year_id) REFERENCES academic_years(id), CHECK(starts_on <= ends_on)
);
CREATE TABLE IF NOT EXISTS teaching_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', external_key TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
  academic_year_id INTEGER NOT NULL, subject_id INTEGER, programme_id INTEGER,
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('academic','homeroom','advisory','club','support','other')),
  default_gradebook_mode TEXT NOT NULL DEFAULT 'graded' CHECK(default_gradebook_mode IN ('graded','standards_only','narrative_only','evidence_only','dormant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, external_key), FOREIGN KEY(academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY(subject_id) REFERENCES academic_subjects(id), FOREIGN KEY(programme_id) REFERENCES academic_programmes(id)
);
CREATE TABLE IF NOT EXISTS teaching_group_teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, teaching_group_id INTEGER NOT NULL, staff_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  assigned_at TEXT NOT NULL DEFAULT(datetime('now')), withdrawn_at TEXT,
  UNIQUE(teaching_group_id, staff_id), FOREIGN KEY(teaching_group_id) REFERENCES teaching_groups(id)
);
CREATE TABLE IF NOT EXISTS teaching_group_enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, teaching_group_id INTEGER NOT NULL, student_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  enrolled_at TEXT NOT NULL DEFAULT(datetime('now')), withdrawn_at TEXT, withdrawal_reason TEXT,
  UNIQUE(teaching_group_id, student_id), FOREIGN KEY(teaching_group_id) REFERENCES teaching_groups(id)
);
CREATE TABLE IF NOT EXISTS academic_structure_event_receipts (
  event_id TEXT PRIMARY KEY, channel TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reporting_period_resolution ON reporting_periods(app_id,academic_year_id,scope_type,scope_id,status);
CREATE INDEX IF NOT EXISTS idx_teaching_groups_year ON teaching_groups(app_id,academic_year_id,status);
CREATE INDEX IF NOT EXISTS idx_teaching_group_teachers_staff ON teaching_group_teachers(staff_id,status);
CREATE INDEX IF NOT EXISTS idx_teaching_group_enrolments_student ON teaching_group_enrolments(student_id,status);
