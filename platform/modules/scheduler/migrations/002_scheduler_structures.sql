CREATE TABLE IF NOT EXISTS scheduler_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
  name TEXT NOT NULL, week_count INTEGER NOT NULL CHECK(week_count BETWEEN 1 AND 52), week_labels_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_setup_id), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id)
);
CREATE TABLE IF NOT EXISTS scheduler_period_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
  external_key TEXT NOT NULL, name TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0),
  multiplier REAL NOT NULL DEFAULT 1 CHECK(multiplier>0), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_setup_id,external_key), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id)
);
CREATE TABLE IF NOT EXISTS scheduler_day_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL, scheduler_scope_id INTEGER NOT NULL,
  cycle_week INTEGER NOT NULL CHECK(cycle_week BETWEEN 1 AND 52), day_index INTEGER NOT NULL CHECK(day_index BETWEEN 1 AND 7),
  name TEXT NOT NULL, is_operating_day INTEGER NOT NULL DEFAULT 1 CHECK(is_operating_day IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,scheduler_scope_id,cycle_week,day_index), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),
  FOREIGN KEY(scheduler_scope_id) REFERENCES scheduler_scopes(id)
);
CREATE TABLE IF NOT EXISTS scheduler_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, day_pattern_id INTEGER NOT NULL, period_template_id INTEGER,
  external_key TEXT NOT NULL, name TEXT NOT NULL, sequence INTEGER NOT NULL CHECK(sequence>0),
  starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('instruction','break','lunch','assembly','meeting','transition','other')),
  counts_as_instruction INTEGER NOT NULL DEFAULT 1 CHECK(counts_as_instruction IN (0,1)), configuration_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id,day_pattern_id,external_key), UNIQUE(app_id,day_pattern_id,sequence),
  FOREIGN KEY(day_pattern_id) REFERENCES scheduler_day_patterns(id), FOREIGN KEY(period_template_id) REFERENCES scheduler_period_templates(id),
  CHECK(starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_days_scope ON scheduler_day_patterns(app_id,scheduler_scope_id,cycle_week,day_index);
CREATE INDEX IF NOT EXISTS idx_scheduler_periods_day ON scheduler_periods(app_id,day_pattern_id,sequence);
