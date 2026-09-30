-- Additive migration: prototype studies, captures and results remain readable.
CREATE TABLE IF NOT EXISTS researched.content_workflows (
 id uuid PRIMARY KEY REFERENCES researched.studies(id), plan jsonb NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS researched.content_links (
 id uuid PRIMARY KEY, workflow_id uuid NOT NULL REFERENCES researched.content_workflows(id),
 url text NOT NULL, occurrences jsonb NOT NULL, included boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL, UNIQUE(workflow_id,url)
);
CREATE TABLE IF NOT EXISTS researched.content_runs (
 id uuid PRIMARY KEY, workflow_id uuid NOT NULL REFERENCES researched.content_workflows(id),
 plan jsonb NOT NULL, version text NOT NULL,
 status text NOT NULL CHECK(status IN('running','completed','cancelled')),
 created_at timestamptz NOT NULL, completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS content_one_active_run ON researched.content_runs(workflow_id) WHERE status='running';
CREATE TABLE IF NOT EXISTS researched.content_tasks (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES researched.content_runs(id),
 link_id uuid NOT NULL REFERENCES researched.content_links(id),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','retry','completed','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0, maximum_attempts integer NOT NULL DEFAULT 3,
 next_attempt_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 error jsonb, result jsonb, UNIQUE(run_id,link_id)
);
CREATE INDEX IF NOT EXISTS content_due_tasks ON researched.content_tasks(status,next_attempt_at);
