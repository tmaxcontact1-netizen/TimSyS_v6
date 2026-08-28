BEGIN;

INSERT INTO jobs (id, job_type, idempotency_key, payload_json, state, available_at)
VALUES (
  '00000000-0000-5000-a000-000000000036',
  'candidate_acquisition',
  'candidate_acquisition:singleton',
  '{"status":"not_started"}'::jsonb,
  'available',
  now()
);

COMMIT;
