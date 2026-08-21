CREATE TABLE IF NOT EXISTS scheduler_requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
  external_key TEXT NOT NULL, academic_year_id TEXT NOT NULL, teaching_group_external_key TEXT NOT NULL,
  name TEXT NOT NULL, occurrences_per_cycle INTEGER NOT NULL CHECK(occurrences_per_cycle>0), duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0),
  eligible_staff_ids_json TEXT NOT NULL DEFAULT '[]', eligible_room_ids_json TEXT NOT NULL DEFAULT '[]', eligible_resource_ids_json TEXT NOT NULL DEFAULT '[]',
  allowed_period_template_keys_json TEXT NOT NULL DEFAULT '[]', attributes_json TEXT NOT NULL DEFAULT '{}', valid_from TEXT, valid_to TEXT,
  source TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_setup_id,external_key), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),
  CHECK(valid_from IS NULL OR valid_to IS NULL OR valid_from<=valid_to)
);
CREATE TABLE IF NOT EXISTS scheduler_validation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL, external_key TEXT NOT NULL,
  candidate_count INTEGER NOT NULL, feasible INTEGER NOT NULL CHECK(feasible IN (0,1)), score REAL NOT NULL,
  hard_violations INTEGER NOT NULL, soft_penalty REAL NOT NULL, advisory_count INTEGER NOT NULL, unplaced_requirements INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(app_id,scheduler_setup_id,external_key),
  FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id)
);
CREATE TABLE IF NOT EXISTS scheduler_validation_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, validation_run_id INTEGER NOT NULL, candidate_external_key TEXT,
  constraint_code TEXT NOT NULL, level TEXT NOT NULL CHECK(level IN ('hard','soft','advisory')),
  message TEXT NOT NULL, evidence_json TEXT NOT NULL DEFAULT '{}', penalty REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT(datetime('now')), FOREIGN KEY(validation_run_id) REFERENCES scheduler_validation_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_requirements_setup ON scheduler_requirements(app_id,scheduler_setup_id,status);
CREATE INDEX IF NOT EXISTS idx_scheduler_findings_run ON scheduler_validation_findings(validation_run_id,level);
