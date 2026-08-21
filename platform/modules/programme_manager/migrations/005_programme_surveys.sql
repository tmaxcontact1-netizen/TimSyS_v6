CREATE TABLE IF NOT EXISTS programme_manager_surveys (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 external_key TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','withdrawn')),
 previous_status TEXT CHECK(previous_status IS NULL OR previous_status IN ('draft','published','closed')),
 settings_json TEXT NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 1,
 current_publication_version INTEGER NOT NULL DEFAULT 0,
 created_by TEXT NOT NULL,
 withdrawn_by TEXT,
 withdrawn_at TEXT,
 withdrawal_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,programme_id,external_key),
 FOREIGN KEY(programme_id) REFERENCES programme_manager_programmes(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_survey_questions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 question_key TEXT NOT NULL,
 parent_question_key TEXT,
 question_type TEXT NOT NULL,
 prompt TEXT NOT NULL,
 help_text TEXT,
 required INTEGER NOT NULL DEFAULT 0,
 sequence INTEGER NOT NULL,
 condition_json TEXT,
 configuration_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(survey_id,question_key),
 UNIQUE(survey_id,sequence),
 FOREIGN KEY(survey_id) REFERENCES programme_manager_surveys(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_survey_publications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 version INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 channels_json TEXT NOT NULL,
 public_token TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','superseded','closed','withdrawn')),
 reason TEXT NOT NULL,
 published_by TEXT NOT NULL,
 published_at TEXT NOT NULL DEFAULT(datetime('now')),
 ended_at TEXT,
 UNIQUE(survey_id,version),
 FOREIGN KEY(survey_id) REFERENCES programme_manager_surveys(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_survey_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(survey_id) REFERENCES programme_manager_surveys(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_surveys_programme ON programme_manager_surveys(app_id,programme_id,status,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_questions_survey ON programme_manager_survey_questions(survey_id,sequence,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_publications_survey ON programme_manager_survey_publications(app_id,survey_id,version DESC);
CREATE INDEX IF NOT EXISTS idx_programme_manager_survey_audit ON programme_manager_survey_audit(app_id,survey_id,id DESC);
