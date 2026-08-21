CREATE TABLE IF NOT EXISTS assessment_scales (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', code TEXT NOT NULL, name TEXT NOT NULL,
 scale_type TEXT NOT NULL CHECK(scale_type IN ('points','percentage','letter','proficiency','pass_fail','custom')),
 version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired','withdrawn')),
 minimum_value REAL, maximum_value REAL, precision_places INTEGER NOT NULL DEFAULT 2,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,code,version), CHECK(minimum_value IS NULL OR maximum_value IS NULL OR minimum_value<=maximum_value)
);
CREATE TABLE IF NOT EXISTS assessment_scale_levels (
 id INTEGER PRIMARY KEY AUTOINCREMENT, scale_id INTEGER NOT NULL, code TEXT NOT NULL, label TEXT NOT NULL, descriptor TEXT,
 ordinal INTEGER NOT NULL, numeric_value REAL, lower_bound REAL, upper_bound REAL,
 is_proficient INTEGER NOT NULL DEFAULT 0 CHECK(is_proficient IN (0,1)), is_passing INTEGER NOT NULL DEFAULT 0 CHECK(is_passing IN (0,1)),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
 UNIQUE(scale_id,code), UNIQUE(scale_id,ordinal), FOREIGN KEY(scale_id) REFERENCES assessment_scales(id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_scales_active ON assessment_scales(app_id,code,status,version);
CREATE INDEX IF NOT EXISTS idx_assessment_scale_levels ON assessment_scale_levels(scale_id,status,ordinal);
