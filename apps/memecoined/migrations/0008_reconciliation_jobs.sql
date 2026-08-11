BEGIN;

ALTER TABLE jobs
  ADD COLUMN last_error_json jsonb,
  ADD COLUMN last_error_at timestamptz;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_last_error_pair_check
  CHECK ((last_error_json IS NULL) = (last_error_at IS NULL));

COMMIT;
