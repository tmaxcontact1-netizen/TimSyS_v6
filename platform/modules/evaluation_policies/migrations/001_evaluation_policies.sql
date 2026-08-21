CREATE TABLE IF NOT EXISTS evaluation_policies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',code TEXT NOT NULL,name TEXT NOT NULL,
 model TEXT NOT NULL CHECK(model IN ('points','percentage','traditional','standards','hybrid')),
 version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired','withdrawn')),
 aggregation TEXT NOT NULL DEFAULT 'mean' CHECK(aggregation IN ('total_points','mean','weighted_mean','latest','highest')),
 rounding_places INTEGER NOT NULL DEFAULT 2,minimum_evidence INTEGER NOT NULL DEFAULT 1,
 missing_rule TEXT NOT NULL DEFAULT 'exclude' CHECK(missing_rule IN ('exclude','zero','incomplete')),
 allow_override INTEGER NOT NULL DEFAULT 1 CHECK(allow_override IN (0,1)),output_scale_id INTEGER,config_json TEXT NOT NULL DEFAULT '{}',
 created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,code,version),FOREIGN KEY(output_scale_id) REFERENCES assessment_scales(id)
);
CREATE TABLE IF NOT EXISTS evaluation_policy_categories (policy_id INTEGER NOT NULL,category_id INTEGER NOT NULL,weight REAL NOT NULL,PRIMARY KEY(policy_id,category_id),FOREIGN KEY(policy_id) REFERENCES evaluation_policies(id),FOREIGN KEY(category_id) REFERENCES assessment_categories(id));
CREATE TABLE IF NOT EXISTS evaluation_policy_assignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',policy_id INTEGER NOT NULL,
 scope_type TEXT NOT NULL CHECK(scope_type IN ('school','programme','course','gradebook')),scope_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),assigned_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,scope_type,scope_id,status),FOREIGN KEY(policy_id) REFERENCES evaluation_policies(id)
);
CREATE INDEX IF NOT EXISTS idx_policy_resolution ON evaluation_policy_assignments(app_id,scope_type,scope_id,status);
