CREATE TABLE IF NOT EXISTS programme_manager_templates (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 template_key TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 scope TEXT NOT NULL DEFAULT 'school' CHECK(scope IN ('system','school')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 previous_status TEXT CHECK(previous_status IS NULL OR previous_status='active'),
 definition_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 source_template_id INTEGER,
 source_programme_id INTEGER,
 created_by TEXT NOT NULL,
 withdrawn_by TEXT,
 withdrawn_at TEXT,
 withdrawal_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,template_key),
 FOREIGN KEY(source_template_id) REFERENCES programme_manager_templates(id),
 FOREIGN KEY(source_programme_id) REFERENCES programme_manager_programmes(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_template_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 template_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(template_id) REFERENCES programme_manager_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_templates_scope ON programme_manager_templates(app_id,status,name,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_template_audit ON programme_manager_template_audit(app_id,template_id,id DESC);

INSERT OR IGNORE INTO programme_manager_templates(app_id,template_key,name,description,scope,definition_json,created_by) VALUES
('*','system:activities','Activities programme','Editable starting point for before-school, timetabled, off-timetable, or after-school activities.','system','{"programme_defaults":{"programme_type":"activities","operating_mode":"mixed","respondent_mode":"student"},"setup_defaults":{"purpose":{"summary":"A configurable activities programme","intended_outcome":"Offer students a structured choice of suitable activities","programme_categories":["activities"],"notes":""},"location":{"strategy":"select_from_scheduler_availability","requirements":[],"notes":""},"participation":{"participant_type":"student","scope":"open","respondent_mode":"student","scope_notes":""},"governance":{"owner_staff_ids":[],"submitter_roles":["student"],"amendment_roles":["student"],"manual_edit_roles":["programme_admin"],"human_confirmation_required":true,"notes":""}}}','system'),
('*','system:enrichment','Enrichment programme','Editable starting point for cross-class or cross-grade enrichment.','system','{"programme_defaults":{"programme_type":"enrichment","operating_mode":"timetabled","respondent_mode":"student"},"setup_defaults":{"purpose":{"summary":"A configurable enrichment programme","intended_outcome":"Broaden student learning through structured enrichment choices","programme_categories":["enrichment"],"notes":""},"location":{"strategy":"select_from_scheduler_availability","requirements":[],"notes":""},"participation":{"participant_type":"student","scope":"cross_grade","respondent_mode":"student","scope_notes":""},"governance":{"owner_staff_ids":[],"submitter_roles":["student"],"amendment_roles":["student"],"manual_edit_roles":["programme_admin"],"human_confirmation_required":true,"notes":""}}}','system'),
('*','system:electives','Electives programme','Editable starting point for a timetable-bound elective selection programme.','system','{"programme_defaults":{"programme_type":"electives","operating_mode":"timetabled","respondent_mode":"student"},"setup_defaults":{"purpose":{"summary":"A configurable electives programme","intended_outcome":"Collect and organise student elective preferences","programme_categories":["electives"],"notes":""},"location":{"strategy":"select_from_scheduler_availability","requirements":[],"notes":""},"participation":{"participant_type":"student","scope":"cross_grade","respondent_mode":"student","scope_notes":""},"governance":{"owner_staff_ids":[],"submitter_roles":["student"],"amendment_roles":["student"],"manual_edit_roles":["programme_admin"],"human_confirmation_required":true,"notes":""}}}','system');
