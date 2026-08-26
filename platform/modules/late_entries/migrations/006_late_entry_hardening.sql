ALTER TABLE late_entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE late_entry_reconciliation_runs ADD COLUMN entry_revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS late_entry_corrections (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',late_entry_id INTEGER NOT NULL,old_value_json TEXT NOT NULL,new_value_json TEXT NOT NULL,
 reason TEXT NOT NULL,actor_id TEXT NOT NULL,requires_attendance_compensation INTEGER NOT NULL DEFAULT 0 CHECK(requires_attendance_compensation IN (0,1)),created_at TEXT NOT NULL DEFAULT(datetime('now')),FOREIGN KEY(late_entry_id) REFERENCES late_entries(id)
);
CREATE TABLE IF NOT EXISTS late_entry_action_policy (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',action TEXT NOT NULL,roles_json TEXT NOT NULL,updated_by TEXT,updated_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(app_id,action)
);
INSERT OR IGNORE INTO late_entry_action_policy(app_id,action,roles_json) VALUES
 ('principal-ed','read','["superuser","super_admin","local_admin","developer","principal","admin","reception","secretary","teacher"]'),
 ('principal-ed','record','["superuser","super_admin","local_admin","developer","principal","admin","reception","secretary","teacher"]'),
 ('principal-ed','reconcile','["superuser","super_admin","local_admin","developer","principal","admin","reception","secretary","attendance_officer"]'),
 ('principal-ed','configure','["superuser","super_admin","local_admin","developer","principal","admin"]'),
 ('principal-ed','restricted_view','["superuser","super_admin","local_admin","developer","principal","admin","reception","secretary","attendance_officer"]');
CREATE TRIGGER IF NOT EXISTS late_entry_policy_no_delete BEFORE DELETE ON late_entry_policy_versions BEGIN SELECT RAISE(ABORT,'Activated attendance policy history cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS late_entry_retired_policy_immutable BEFORE UPDATE ON late_entry_policy_versions WHEN OLD.status='retired' BEGIN SELECT RAISE(ABORT,'Retired attendance policy is immutable'); END;
CREATE TRIGGER IF NOT EXISTS late_entry_active_policy_immutable BEFORE UPDATE ON late_entry_policy_versions
 WHEN OLD.status='active' AND NOT (NEW.status='retired' AND NEW.version=OLD.version AND NEW.effective_from=OLD.effective_from AND NEW.school_day_grace_minutes=OLD.school_day_grace_minutes AND NEW.class_grace_minutes=OLD.class_grace_minutes AND NEW.school_tardies_per_absence IS OLD.school_tardies_per_absence AND NEW.class_tardies_per_absence IS OLD.class_tardies_per_absence AND NEW.count_excused=OLD.count_excused AND NEW.rules_json=OLD.rules_json)
 BEGIN SELECT RAISE(ABORT,'Active attendance policy content is immutable'); END;
CREATE INDEX IF NOT EXISTS idx_late_corrections_entry ON late_entry_corrections(app_id,late_entry_id,created_at);
