CREATE TABLE IF NOT EXISTS assessment_evaluation_audits (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', title TEXT NOT NULL,
 subject TEXT, grade_band TEXT, source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual','document','benchmark','import')),
 framework_id INTEGER, workflow_mode TEXT NOT NULL DEFAULT 'teacher' CHECK(workflow_mode IN ('teacher','coordinator')),
 analysis_profile TEXT NOT NULL DEFAULT 'ela_v1', intent_text TEXT, intent_standard_codes_json TEXT NOT NULL DEFAULT '[]', intent_unlocked_at TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_progress','review','complete','withdrawn')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(framework_id) REFERENCES standards_frameworks(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_frameworks (
 audit_id INTEGER NOT NULL, framework_id INTEGER NOT NULL, comparison_role TEXT NOT NULL DEFAULT 'primary' CHECK(comparison_role IN ('primary','comparison','cross_subject')),
 created_at TEXT NOT NULL DEFAULT(datetime('now')), PRIMARY KEY(audit_id,framework_id),
 FOREIGN KEY(audit_id) REFERENCES assessment_evaluation_audits(id), FOREIGN KEY(framework_id) REFERENCES standards_repository_frameworks(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_sources (
 id INTEGER PRIMARY KEY AUTOINCREMENT, audit_id INTEGER NOT NULL, document_id INTEGER, filename TEXT NOT NULL, mime_type TEXT,
 source_role TEXT NOT NULL DEFAULT 'question_paper' CHECK(source_role IN ('question_paper','answer_key','rubric','specification','declared_objectives')),
 extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK(extraction_status IN ('pending','extracted','needs_review','failed')),
 extracted_text TEXT, extraction_notes TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(audit_id) REFERENCES assessment_evaluation_audits(id), FOREIGN KEY(document_id) REFERENCES documents(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_item_candidates (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL, item_key TEXT NOT NULL, stimulus TEXT, task TEXT NOT NULL,
 answer_choices_json TEXT NOT NULL DEFAULT '[]', response_format TEXT, source_locator_json TEXT NOT NULL DEFAULT '{}', media_json TEXT NOT NULL DEFAULT '[]',
 extraction_confidence REAL, warnings_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','edited')),
 reviewed_by TEXT, reviewed_at TEXT, created_item_id INTEGER, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(source_id) REFERENCES assessment_evaluation_sources(id), FOREIGN KEY(created_item_id) REFERENCES assessment_evaluation_items(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, audit_id INTEGER NOT NULL, item_key TEXT NOT NULL,
 stimulus TEXT, task TEXT NOT NULL, answer_choices_json TEXT NOT NULL DEFAULT '[]', response_format TEXT, media_json TEXT NOT NULL DEFAULT '[]',
 visible_scaffolding_json TEXT NOT NULL DEFAULT '[]', supporting_information TEXT,
 task_presentation TEXT, assessment_demand TEXT, primary_construct TEXT, supporting_constructs_json TEXT,
 relationship_analysed TEXT, evidence_behaviour TEXT, scaffolding_analysis TEXT, independence_depth TEXT,
 analysis_stage TEXT, analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK(analysis_status IN ('pending','high_confidence','probable','ambiguous','unmapped','insufficient_information','human_review')),
 analysis_rationale TEXT, analysis_locked_at TEXT, analysed_by TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(audit_id,item_key), FOREIGN KEY(audit_id) REFERENCES assessment_evaluation_audits(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_alignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, standard_id INTEGER, repository_statement_id INTEGER, ontology_node_id INTEGER, framework_id INTEGER,
 rank INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL CHECK(status IN ('high_confidence','probable','ambiguous','unmapped','insufficient_information','human_review')),
 rationale TEXT NOT NULL, confidence_score REAL, method TEXT NOT NULL, decided_by TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(item_id) REFERENCES assessment_evaluation_items(id), FOREIGN KEY(standard_id) REFERENCES learning_standards(id),
 FOREIGN KEY(repository_statement_id) REFERENCES standards_repository_statements(id), FOREIGN KEY(ontology_node_id) REFERENCES standards_ontology_nodes(id),
 FOREIGN KEY(framework_id) REFERENCES standards_repository_frameworks(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('confirm','revise','unmapped','human_review')),
 primary_construct TEXT, standard_id INTEGER, status TEXT NOT NULL, rationale TEXT NOT NULL, reviewer_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), FOREIGN KEY(item_id) REFERENCES assessment_evaluation_items(id), FOREIGN KEY(standard_id) REFERENCES learning_standards(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_interpretations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, ai_run_id INTEGER NOT NULL,
 interpretation_json TEXT NOT NULL, confidence REAL NOT NULL, evidence_ids_json TEXT NOT NULL DEFAULT '[]', limitations_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','rejected')),
 reviewed_by TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(item_id) REFERENCES assessment_evaluation_items(id), FOREIGN KEY(ai_run_id) REFERENCES ai_gateway_runs(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_reference_metadata (
 item_id INTEGER PRIMARY KEY, official_claim_target TEXT, official_standards_json TEXT, official_dok TEXT,
 evidence_statement TEXT, answer_key TEXT, scoring_guidance TEXT, revealed_at TEXT,
 FOREIGN KEY(item_id) REFERENCES assessment_evaluation_items(id)
);
CREATE TABLE IF NOT EXISTS assessment_evaluation_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT, audit_id INTEGER NOT NULL, version INTEGER NOT NULL, report_json TEXT NOT NULL,
 generated_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(audit_id,version),
 FOREIGN KEY(audit_id) REFERENCES assessment_evaluation_audits(id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_audits ON assessment_evaluation_audits(app_id,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_items ON assessment_evaluation_items(audit_id,analysis_status);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_alignments ON assessment_evaluation_alignments(item_id,rank);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_frameworks ON assessment_evaluation_frameworks(audit_id,comparison_role);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_sources ON assessment_evaluation_sources(audit_id,source_role);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_candidates ON assessment_evaluation_item_candidates(source_id,status,id);
CREATE INDEX IF NOT EXISTS idx_assessment_eval_interpretations ON assessment_evaluation_interpretations(item_id,status,id);
