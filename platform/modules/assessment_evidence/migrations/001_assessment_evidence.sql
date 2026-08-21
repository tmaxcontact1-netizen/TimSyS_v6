CREATE TABLE IF NOT EXISTS assessment_categories (id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',code TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),UNIQUE(app_id,code));
CREATE TABLE IF NOT EXISTS assessments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, gradebook_id INTEGER NOT NULL, category_id INTEGER, scale_id INTEGER NOT NULL,
 title TEXT NOT NULL, description TEXT, assessment_date TEXT, due_date TEXT, maximum_points REAL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','withdrawn')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id), FOREIGN KEY(category_id) REFERENCES assessment_categories(id), FOREIGN KEY(scale_id) REFERENCES assessment_scales(id)
);
CREATE TABLE IF NOT EXISTS assessment_standard_mappings (assessment_id INTEGER NOT NULL,standard_id INTEGER NOT NULL,weight REAL NOT NULL DEFAULT 1,PRIMARY KEY(assessment_id,standard_id),FOREIGN KEY(assessment_id) REFERENCES assessments(id),FOREIGN KEY(standard_id) REFERENCES learning_standards(id));
CREATE TABLE IF NOT EXISTS assessment_evidence (
 id INTEGER PRIMARY KEY AUTOINCREMENT, assessment_id INTEGER NOT NULL, student_id TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 1,
 state TEXT NOT NULL CHECK(state IN ('recorded','missing','incomplete','exempt','absent','late','not_assessed','invalid')),
 raw_numeric REAL, raw_text TEXT, scale_level_id INTEGER, notes TEXT, observed_at TEXT,
 assessor_id TEXT NOT NULL, supersedes_id INTEGER, superseded_by_id INTEGER,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(assessment_id,student_id,attempt),
 FOREIGN KEY(assessment_id) REFERENCES assessments(id),FOREIGN KEY(scale_level_id) REFERENCES assessment_scale_levels(id),FOREIGN KEY(supersedes_id) REFERENCES assessment_evidence(id),FOREIGN KEY(superseded_by_id) REFERENCES assessment_evidence(id)
);
CREATE INDEX IF NOT EXISTS idx_assessments_gradebook ON assessments(gradebook_id,status,assessment_date);
CREATE INDEX IF NOT EXISTS idx_evidence_student ON assessment_evidence(student_id,assessment_id,state);
