BEGIN;

ALTER TABLE paper_profile_activations
  DROP CONSTRAINT IF EXISTS paper_profile_activations_check1;

ALTER TABLE paper_profile_activations
  ADD CONSTRAINT paper_profile_activations_automatic_allocation_check
  CHECK (NOT enabled OR mode <> 'automatic_paper' OR allocation_bps > 0);

COMMIT;
