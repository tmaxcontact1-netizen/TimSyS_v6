CREATE TABLE IF NOT EXISTS researched.analysis_plans(
 id uuid PRIMARY KEY, study_id uuid NOT NULL REFERENCES researched.studies(id), name text NOT NULL,
 analysis_types jsonb NOT NULL, source_ids jsonb NOT NULL DEFAULT '[]', custom_questions jsonb NOT NULL DEFAULT '[]',
 expected_fields jsonb NOT NULL DEFAULT '[]', options jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1,
 created_by text NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS researched.analysis_runs(
 id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES researched.analysis_plans(id), study_id uuid NOT NULL REFERENCES researched.studies(id),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','completed','partial','failed','cancelled')),
 progress_completed integer NOT NULL DEFAULT 0, progress_total integer NOT NULL DEFAULT 0, rules_version text NOT NULL,
 model_provider text, model_name text, model_version text, error_summary text, requested_by text NOT NULL,
 created_at timestamptz NOT NULL, started_at timestamptz, completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS researched.analysis_results(
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES researched.analysis_runs(id), study_id uuid NOT NULL REFERENCES researched.studies(id),
 source_id uuid REFERENCES researched.sources(id), analysis_type text NOT NULL, method text NOT NULL CHECK(method IN('rules','ai','hybrid')),
 status text NOT NULL DEFAULT 'generated' CHECK(status IN('generated','accepted','amended','rejected')),
 value jsonb NOT NULL, confidence numeric CHECK(confidence IS NULL OR confidence BETWEEN 0 AND 1),
 evidence_segment_ids jsonb NOT NULL DEFAULT '[]', rule_version text, model_metadata jsonb,
 review_reason text, reviewed_by text, reviewed_at timestamptz, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS researched_analysis_plan_study_idx ON researched.analysis_plans(study_id,created_at DESC);
CREATE INDEX IF NOT EXISTS researched_analysis_run_study_idx ON researched.analysis_runs(study_id,created_at DESC);
CREATE INDEX IF NOT EXISTS researched_analysis_result_run_idx ON researched.analysis_results(run_id,analysis_type,source_id);
