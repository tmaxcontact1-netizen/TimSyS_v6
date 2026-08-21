CREATE TABLE IF NOT EXISTS gradebook_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', teaching_group_id INTEGER NOT NULL,
  identity_key TEXT NOT NULL, academic_year_id INTEGER NOT NULL, subject_id INTEGER,
  name TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('graded','standards_only','narrative_only','evidence_only','dormant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed','archived','withdrawn')),
  reporting_period_scope_type TEXT, reporting_period_scope_id TEXT,
  provisioned_by TEXT NOT NULL DEFAULT 'academic_structure',
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')), closed_at TEXT,
  UNIQUE(app_id, teaching_group_id), UNIQUE(app_id, identity_key),
  FOREIGN KEY(teaching_group_id) REFERENCES teaching_groups(id), FOREIGN KEY(academic_year_id) REFERENCES academic_years(id)
);
CREATE INDEX IF NOT EXISTS idx_gradebook_instances_year ON gradebook_instances(app_id,academic_year_id,status);
CREATE INDEX IF NOT EXISTS idx_gradebook_instances_subject ON gradebook_instances(subject_id,status);
