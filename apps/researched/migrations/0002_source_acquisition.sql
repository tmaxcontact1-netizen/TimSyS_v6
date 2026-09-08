ALTER TABLE researched.sources ADD COLUMN IF NOT EXISTS retrieval_status text NOT NULL DEFAULT 'not_fetched' CHECK(retrieval_status IN('not_fetched','fetching','available','unchanged','failed'));
ALTER TABLE researched.sources ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz;
ALTER TABLE researched.sources ADD COLUMN IF NOT EXISTS last_http_status integer;
ALTER TABLE researched.sources ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE researched.sources ADD COLUMN IF NOT EXISTS resolved_url text;
CREATE TABLE IF NOT EXISTS researched.retrieval_attempts(
 id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES researched.sources(id), started_at timestamptz NOT NULL, completed_at timestamptz,
 requested_url text NOT NULL, resolved_url text, http_status integer, outcome text NOT NULL CHECK(outcome IN('started','snapshot_created','unchanged','failed')),
 error_code text, response_metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS researched_retrieval_source_idx ON researched.retrieval_attempts(source_id,started_at DESC);
