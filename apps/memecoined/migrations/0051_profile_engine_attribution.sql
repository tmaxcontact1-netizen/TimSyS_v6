BEGIN;

ALTER TABLE paper_profile_candidate_decisions
  ADD COLUMN engine_version text NOT NULL DEFAULT 'snapshot-v1';

CREATE INDEX paper_profile_decisions_engine_idx
  ON paper_profile_candidate_decisions (wallet,profile_id,engine_version,evaluated_at DESC);

COMMIT;
