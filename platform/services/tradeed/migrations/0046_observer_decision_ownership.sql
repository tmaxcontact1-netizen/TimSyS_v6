BEGIN;

ALTER TABLE paper_profile_candidate_decisions
  DROP CONSTRAINT IF EXISTS paper_profile_candidate_decisions_wallet_profile_id_fkey;

ALTER TABLE paper_profile_candidate_decisions
  ADD CONSTRAINT paper_profile_candidate_decisions_activation_fkey
  FOREIGN KEY (wallet,profile_id)
  REFERENCES paper_profile_activations(wallet,profile_id);

COMMIT;
