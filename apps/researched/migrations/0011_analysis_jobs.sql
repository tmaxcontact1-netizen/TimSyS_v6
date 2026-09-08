ALTER TABLE researched.analysis_runs DROP CONSTRAINT IF EXISTS analysis_runs_status_check;
ALTER TABLE researched.analysis_runs ADD CONSTRAINT analysis_runs_status_check CHECK(status IN('queued','running','paused','completed','partial','failed','cancelled'));
ALTER TABLE researched.analysis_runs ADD COLUMN IF NOT EXISTS maximum_attempts integer NOT NULL DEFAULT 3 CHECK(maximum_attempts BETWEEN 1 AND 10);
ALTER TABLE researched.analysis_runs ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE researched.analysis_runs ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE TABLE IF NOT EXISTS researched.analysis_run_items(
 id uuid PRIMARY KEY,
 run_id uuid NOT NULL REFERENCES researched.analysis_runs(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES researched.sources(id),
 analysis_type text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','succeeded','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0,
 maximum_attempts integer NOT NULL DEFAULT 3 CHECK(maximum_attempts BETWEEN 1 AND 10),
 next_attempt_at timestamptz NOT NULL,
 last_error text,
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz NOT NULL,
 UNIQUE(run_id,source_id,analysis_type)
);
CREATE INDEX IF NOT EXISTS researched_analysis_job_ready_idx ON researched.analysis_run_items(status,next_attempt_at,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS researched_analysis_result_identity_idx ON researched.analysis_results(run_id,source_id,analysis_type);
