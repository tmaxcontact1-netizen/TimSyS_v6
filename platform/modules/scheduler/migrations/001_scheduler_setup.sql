CREATE TABLE IF NOT EXISTS scheduler_setups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  academic_year_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  scope_mode TEXT NOT NULL CHECK(scope_mode IN ('school','selected')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','withdrawn')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  week_starts_on INTEGER NOT NULL DEFAULT 1 CHECK(week_starts_on BETWEEN 1 AND 7),
  configuration_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, academic_year_id),
  FOREIGN KEY(academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS scheduler_scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  scheduler_setup_id INTEGER NOT NULL,
  external_key TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('school','section','programme','grade','custom')),
  scope_ref TEXT NOT NULL,
  name TEXT NOT NULL,
  configuration_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(app_id, scheduler_setup_id, external_key),
  UNIQUE(app_id, scheduler_setup_id, scope_type, scope_ref),
  FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_setup_year ON scheduler_setups(app_id, academic_year_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduler_scope_setup ON scheduler_scopes(app_id, scheduler_setup_id, status);
