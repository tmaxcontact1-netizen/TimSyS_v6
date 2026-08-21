CREATE TABLE IF NOT EXISTS scheduler_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
  external_key TEXT NOT NULL, entity_type TEXT NOT NULL CHECK(entity_type IN ('staff','room','resource','scope','teaching_group','location')),
  entity_ref TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('available','unavailable','preferred','discouraged','conditional')),
  cycle_week INTEGER, day_index INTEGER, starts_at TEXT, ends_at TEXT, valid_from TEXT, valid_to TEXT,
  condition_json TEXT NOT NULL DEFAULT '{}', reason TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_setup_id,external_key), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),
  CHECK(cycle_week IS NULL OR cycle_week>0), CHECK(day_index IS NULL OR day_index BETWEEN 1 AND 7),
  CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at<ends_at), CHECK(valid_from IS NULL OR valid_to IS NULL OR valid_from<=valid_to)
);
CREATE TABLE IF NOT EXISTS scheduler_constraints (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
  code TEXT NOT NULL, name TEXT NOT NULL, level TEXT NOT NULL CHECK(level IN ('hard','soft','advisory')),
  scope_type TEXT NOT NULL CHECK(scope_type IN ('school','section','programme','grade','custom')), scope_ref TEXT NOT NULL,
  rule_type TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1 CHECK(weight>=0), parameters_json TEXT NOT NULL DEFAULT '{}',
  explanation_template TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_setup_id,code), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id)
);
CREATE TABLE IF NOT EXISTS scheduler_travel_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
  from_location_ref TEXT NOT NULL, to_location_ref TEXT NOT NULL, minutes INTEGER NOT NULL CHECK(minutes>=0),
  bidirectional INTEGER NOT NULL DEFAULT 1 CHECK(bidirectional IN (0,1)), reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_setup_id,from_location_ref,to_location_ref), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),
  CHECK(from_location_ref<>to_location_ref)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_availability_entity ON scheduler_availability(app_id,scheduler_setup_id,entity_type,entity_ref,status);
CREATE INDEX IF NOT EXISTS idx_scheduler_constraints_scope ON scheduler_constraints(app_id,scheduler_setup_id,scope_type,scope_ref,level,status);
