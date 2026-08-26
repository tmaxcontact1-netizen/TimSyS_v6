CREATE TABLE IF NOT EXISTS late_entry_policy_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',version INTEGER NOT NULL,effective_from TEXT NOT NULL,effective_to TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired')),school_day_grace_minutes INTEGER NOT NULL DEFAULT 0 CHECK(school_day_grace_minutes>=0),class_grace_minutes INTEGER NOT NULL DEFAULT 0 CHECK(class_grace_minutes>=0),
 school_tardies_per_absence INTEGER CHECK(school_tardies_per_absence>0),class_tardies_per_absence INTEGER CHECK(class_tardies_per_absence>0),count_excused INTEGER NOT NULL DEFAULT 0 CHECK(count_excused IN (0,1)),
 rules_json TEXT NOT NULL DEFAULT '{}',created_by TEXT NOT NULL,confirmed_by TEXT,confirmed_at TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(app_id,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_late_entry_policy ON late_entry_policy_versions(app_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS late_entry_reasons (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',code TEXT NOT NULL,label TEXT NOT NULL,classification TEXT NOT NULL DEFAULT 'pending' CHECK(classification IN ('excused','unexcused','pending')),
 evidence_required INTEGER NOT NULL DEFAULT 0 CHECK(evidence_required IN (0,1)),restricted INTEGER NOT NULL DEFAULT 0 CHECK(restricted IN (0,1)),enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(app_id,code)
);
CREATE TABLE IF NOT EXISTS late_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',student_id TEXT NOT NULL,arrival_at TEXT NOT NULL,occurrence_type TEXT NOT NULL CHECK(occurrence_type IN ('school_arrival','class_arrival')),
 reason_code TEXT NOT NULL,classification TEXT NOT NULL CHECK(classification IN ('excused','unexcused','pending')),status TEXT NOT NULL DEFAULT 'recorded' CHECK(status IN ('recorded','context_resolved','reconciliation_pending','reconciled','exception','corrected','withdrawn')),
 policy_version_id INTEGER,minutes_late INTEGER,recorded_location_ref TEXT,recorded_by TEXT NOT NULL,operational_note TEXT,evidence_reference TEXT,client_request_id TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(policy_version_id) REFERENCES late_entry_policy_versions(id),UNIQUE(app_id,client_request_id)
);
CREATE TABLE IF NOT EXISTS late_entry_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',late_entry_id INTEGER,action TEXT NOT NULL,actor_id TEXT NOT NULL,old_value_json TEXT,new_value_json TEXT,reason TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),FOREIGN KEY(late_entry_id) REFERENCES late_entries(id)
);
CREATE INDEX IF NOT EXISTS idx_late_entries_student_time ON late_entries(app_id,student_id,arrival_at);
CREATE INDEX IF NOT EXISTS idx_late_entries_status ON late_entries(app_id,status,arrival_at);
INSERT OR IGNORE INTO late_entry_reasons(app_id,code,label,classification,evidence_required,restricted) VALUES
 ('principal-ed','transport_delay','Transport delay','pending',0,0),('principal-ed','appointment','Appointment','excused',1,1),('principal-ed','illness','Illness or medical reason','excused',0,1),
 ('principal-ed','family_reason','Family reason','pending',0,1),('principal-ed','school_activity','School-authorised activity','excused',0,0),('principal-ed','unexplained','No reason provided','unexcused',0,0),('principal-ed','other','Other','pending',0,0);
