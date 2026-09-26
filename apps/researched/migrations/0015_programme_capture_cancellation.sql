ALTER TABLE researched.programme_capture_jobs
  DROP CONSTRAINT IF EXISTS programme_capture_jobs_status_check;
ALTER TABLE researched.programme_capture_jobs
  ADD CONSTRAINT programme_capture_jobs_status_check
  CHECK(status IN('queued','running','succeeded','failed','cancelled'));

UPDATE researched.programme_capture_jobs j
SET status='failed',
    last_error='Capture was marked complete but no programme record was saved',
    completed_at=now(),
    updated_at=now()
WHERE j.status='succeeded'
  AND NOT EXISTS (
    SELECT 1 FROM researched.programme_records r WHERE r.candidate_id=j.candidate_id
  );
