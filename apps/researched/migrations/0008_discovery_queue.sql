CREATE TABLE IF NOT EXISTS researched.discovered_links(
 id uuid PRIMARY KEY, study_id uuid NOT NULL REFERENCES researched.studies(id), parent_source_id uuid NOT NULL REFERENCES researched.sources(id), snapshot_id uuid NOT NULL REFERENCES researched.source_snapshots(id),
 discovered_url text NOT NULL, link_text text, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','added','dismissed')), decision_reason text,
 discovered_at timestamptz NOT NULL, decided_at timestamptz, UNIQUE(study_id,discovered_url)
);
CREATE TABLE IF NOT EXISTS researched.acquisition_queue(
 id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES researched.sources(id), status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','succeeded','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), maximum_attempts integer NOT NULL DEFAULT 3 CHECK(maximum_attempts BETWEEN 1 AND 10),
 next_attempt_at timestamptz NOT NULL, last_error text, created_at timestamptz NOT NULL, started_at timestamptz, completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS researched_active_acquisition_source_idx ON researched.acquisition_queue(source_id) WHERE status IN('queued','running');
CREATE INDEX IF NOT EXISTS researched_discovery_study_idx ON researched.discovered_links(study_id,status,discovered_at DESC);
CREATE INDEX IF NOT EXISTS researched_queue_ready_idx ON researched.acquisition_queue(status,next_attempt_at);
