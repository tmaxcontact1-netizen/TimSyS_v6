CREATE TABLE IF NOT EXISTS behaviour_frameworks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL DEFAULT 'principal-ed',
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','retired','withdrawn')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,code,version)
);

CREATE TABLE IF NOT EXISTS behaviour_indicators (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 framework_id INTEGER NOT NULL,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 domain TEXT NOT NULL,
 description TEXT,
 sequence INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 FOREIGN KEY(framework_id) REFERENCES behaviour_frameworks(id),
 UNIQUE(framework_id,code)
);

CREATE TABLE IF NOT EXISTS gradebook_behaviour_frameworks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 gradebook_id INTEGER NOT NULL,
 framework_id INTEGER NOT NULL,
 scale_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 assigned_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id),
 FOREIGN KEY(framework_id) REFERENCES behaviour_frameworks(id),
 FOREIGN KEY(scale_id) REFERENCES assessment_scales(id),
 UNIQUE(gradebook_id,framework_id)
);

CREATE TABLE IF NOT EXISTS behaviour_observations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 gradebook_id INTEGER NOT NULL,
 student_id TEXT NOT NULL,
 indicator_id INTEGER NOT NULL,
 scale_level_id INTEGER NOT NULL,
 observed_at TEXT NOT NULL,
 notes TEXT,
 recorded_by TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded')),
 supersedes_id INTEGER,
 superseded_by_id INTEGER,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id),
 FOREIGN KEY(indicator_id) REFERENCES behaviour_indicators(id),
 FOREIGN KEY(scale_level_id) REFERENCES assessment_scale_levels(id),
 FOREIGN KEY(supersedes_id) REFERENCES behaviour_observations(id),
 FOREIGN KEY(superseded_by_id) REFERENCES behaviour_observations(id)
);

CREATE INDEX IF NOT EXISTS idx_behaviour_observations_student
 ON behaviour_observations(gradebook_id,student_id,observed_at);
CREATE INDEX IF NOT EXISTS idx_behaviour_observations_indicator
 ON behaviour_observations(indicator_id,student_id,superseded_by_id);
