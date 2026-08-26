CREATE TABLE IF NOT EXISTS late_entry_equivalence_calculations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',student_id TEXT NOT NULL,scope_type TEXT NOT NULL CHECK(scope_type IN ('school','class')),
 scope_ref TEXT NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,policy_version_id INTEGER NOT NULL,divisor INTEGER NOT NULL CHECK(divisor>0),
 occurrence_ids_json TEXT NOT NULL,tardy_count INTEGER NOT NULL CHECK(tardy_count>=0),absence_equivalent_units INTEGER NOT NULL CHECK(absence_equivalent_units>=0),remainder_tardies INTEGER NOT NULL CHECK(remainder_tardies>=0),
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','confirmed','void')),calculated_by TEXT NOT NULL,calculated_at TEXT NOT NULL DEFAULT(datetime('now')),
 confirmed_by TEXT,confirmed_at TEXT,decision_reason TEXT,voided_by TEXT,voided_at TEXT,void_reason TEXT,FOREIGN KEY(policy_version_id) REFERENCES late_entry_policy_versions(id)
);
CREATE TABLE IF NOT EXISTS late_entry_equivalence_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',calculation_id INTEGER NOT NULL,action TEXT NOT NULL,actor_id TEXT NOT NULL,value_json TEXT NOT NULL,reason TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),FOREIGN KEY(calculation_id) REFERENCES late_entry_equivalence_calculations(id)
);
CREATE INDEX IF NOT EXISTS idx_late_equivalence_student ON late_entry_equivalence_calculations(app_id,student_id,scope_type,scope_ref,period_start,period_end,status);
