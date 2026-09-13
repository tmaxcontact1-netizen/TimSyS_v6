BEGIN;

ALTER TABLE paper_profile_candidate_decisions
  ADD COLUMN entry_state text NOT NULL DEFAULT 'not_applicable'
    CHECK (entry_state IN ('not_applicable','pending','retrying','entered','failed')),
  ADD COLUMN entry_attempts integer NOT NULL DEFAULT 0 CHECK (entry_attempts >= 0),
  ADD COLUMN next_entry_attempt_at timestamptz,
  ADD COLUMN last_entry_error text,
  ADD COLUMN entered_at timestamptz;

UPDATE paper_profile_candidate_decisions
   SET entry_state='pending', next_entry_attempt_at=evaluated_at
 WHERE eligible=true AND mode='automatic_paper';

CREATE INDEX paper_profile_entry_attempts_due_idx
  ON paper_profile_candidate_decisions (wallet,next_entry_attempt_at,profile_id)
  WHERE entry_state IN ('pending','retrying');

COMMIT;
