BEGIN;

CREATE SCHEMA IF NOT EXISTS dressed;

CREATE TABLE IF NOT EXISTS dressed.dressed_schema_migrations (
  migration_name text PRIMARY KEY,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
