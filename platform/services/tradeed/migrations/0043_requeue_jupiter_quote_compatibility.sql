BEGIN;

-- Jupiter removed optional per-route fee fields from its live quote response.
-- Requeue only decisions rejected by the superseded response parser; other
-- terminal failures remain untouched for audit and operator review.
UPDATE paper_profile_candidate_decisions
   SET entry_state='pending',
       entry_attempts=0,
       next_entry_attempt_at=now(),
       last_entry_error=NULL
 WHERE eligible=true
   AND mode='automatic_paper'
   AND entry_state='failed'
   AND last_entry_error='jupiter: Malformed Jupiter quote';

COMMIT;
