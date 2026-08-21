CREATE TABLE IF NOT EXISTS scheduler_lifecycle_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, schedule_version_id INTEGER NOT NULL,
 from_status TEXT NOT NULL, to_status TEXT NOT NULL, reason TEXT, actor_id TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), FOREIGN KEY(schedule_version_id) REFERENCES scheduler_versions(id)
);
CREATE TABLE IF NOT EXISTS scheduler_publication_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, schedule_version_id INTEGER NOT NULL,
 placement_id INTEGER NOT NULL, calendar_entry_id INTEGER, teaching_group_id INTEGER,
 publication_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,publication_key), FOREIGN KEY(schedule_version_id) REFERENCES scheduler_versions(id),
 FOREIGN KEY(placement_id) REFERENCES scheduler_placements(id), FOREIGN KEY(calendar_entry_id) REFERENCES calendar_entries(id),
 FOREIGN KEY(teaching_group_id) REFERENCES teaching_groups(id)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_publication_version ON scheduler_publication_links(app_id,schedule_version_id);
