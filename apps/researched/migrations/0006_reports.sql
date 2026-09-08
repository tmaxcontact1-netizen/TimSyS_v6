CREATE TABLE IF NOT EXISTS researched.report_runs(
 id uuid PRIMARY KEY,
 study_id uuid NOT NULL REFERENCES researched.studies(id),
 title text NOT NULL,
 configuration jsonb NOT NULL,
 report_payload jsonb NOT NULL,
 content_hash text NOT NULL,
 generated_by text NOT NULL,
 generated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS researched_reports_study_idx ON researched.report_runs(study_id,generated_at DESC);
