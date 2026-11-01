BEGIN;

CREATE INDEX score_breakdowns_candidate_latest_idx
  ON score_breakdowns (candidate_id, evaluated_at DESC, id DESC);

UPDATE paper_profile_candidate_decisions
   SET entry_state='failed',
       last_entry_error=COALESCE(last_entry_error, 'Entry is no longer actionable'),
       next_entry_attempt_at=NULL
 WHERE entry_state IN ('pending','retrying')
   AND (entry_attempts>=5 OR next_entry_attempt_at IS NULL);

COMMIT;
