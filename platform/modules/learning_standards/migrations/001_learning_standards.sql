CREATE TABLE IF NOT EXISTS standards_frameworks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', code TEXT NOT NULL, name TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, subject_id INTEGER, grade_band TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired','withdrawn')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,code,version), FOREIGN KEY(subject_id) REFERENCES academic_subjects(id)
);
CREATE TABLE IF NOT EXISTS learning_standards (
 id INTEGER PRIMARY KEY AUTOINCREMENT, framework_id INTEGER NOT NULL, parent_id INTEGER, code TEXT NOT NULL, title TEXT NOT NULL,
 description TEXT, level INTEGER NOT NULL DEFAULT 1, sequence INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
 UNIQUE(framework_id,code), FOREIGN KEY(framework_id) REFERENCES standards_frameworks(id), FOREIGN KEY(parent_id) REFERENCES learning_standards(id)
);
CREATE TABLE IF NOT EXISTS gradebook_standard_frameworks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, gradebook_id INTEGER NOT NULL, framework_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')), assigned_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(gradebook_id,framework_id), FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id), FOREIGN KEY(framework_id) REFERENCES standards_frameworks(id)
);
CREATE INDEX IF NOT EXISTS idx_frameworks_active ON standards_frameworks(app_id,subject_id,status,version);
CREATE INDEX IF NOT EXISTS idx_learning_standards_tree ON learning_standards(framework_id,parent_id,sequence);
