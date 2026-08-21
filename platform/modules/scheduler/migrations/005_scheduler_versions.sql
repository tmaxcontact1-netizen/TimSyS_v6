CREATE TABLE IF NOT EXISTS scheduler_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
 external_key TEXT NOT NULL, name TEXT NOT NULL, alternative_number INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('draft','generated','validated','submitted','approved','published','rejected','superseded')),
 generation_strategy TEXT NOT NULL, feasible INTEGER NOT NULL DEFAULT 0 CHECK(feasible IN (0,1)), score REAL NOT NULL DEFAULT 0,
 validation_run_id INTEGER, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,scheduler_setup_id,external_key), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),
 FOREIGN KEY(validation_run_id) REFERENCES scheduler_validation_runs(id)
);
CREATE TABLE IF NOT EXISTS scheduler_placements (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, schedule_version_id INTEGER NOT NULL,
 external_key TEXT NOT NULL, requirement_external_key TEXT NOT NULL, teaching_group_external_key TEXT NOT NULL,
 scheduler_scope_id INTEGER NOT NULL, week_index INTEGER NOT NULL, day_index INTEGER NOT NULL,
 start_time TEXT NOT NULL, end_time TEXT NOT NULL, staff_ids_json TEXT NOT NULL DEFAULT '[]', room_ids_json TEXT NOT NULL DEFAULT '[]',
 resource_ids_json TEXT NOT NULL DEFAULT '[]', location_ref TEXT, status TEXT NOT NULL DEFAULT 'proposed', locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
 override_reason TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,schedule_version_id,external_key), FOREIGN KEY(schedule_version_id) REFERENCES scheduler_versions(id),
 FOREIGN KEY(scheduler_scope_id) REFERENCES scheduler_scopes(id), CHECK(start_time<end_time)
);
CREATE TABLE IF NOT EXISTS scheduler_override_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, schedule_version_id INTEGER NOT NULL, placement_id INTEGER NOT NULL,
 previous_json TEXT NOT NULL, replacement_json TEXT NOT NULL, reason TEXT NOT NULL, validation_run_id INTEGER,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), FOREIGN KEY(schedule_version_id) REFERENCES scheduler_versions(id),
 FOREIGN KEY(placement_id) REFERENCES scheduler_placements(id), FOREIGN KEY(validation_run_id) REFERENCES scheduler_validation_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_versions_setup ON scheduler_versions(app_id,scheduler_setup_id,status,score);
CREATE INDEX IF NOT EXISTS idx_scheduler_placements_version ON scheduler_placements(app_id,schedule_version_id,week_index,day_index,start_time);
