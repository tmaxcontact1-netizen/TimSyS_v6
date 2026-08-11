BEGIN;
ALTER TABLE entry_plans DROP CONSTRAINT entry_plans_state_check;
ALTER TABLE entry_plans ADD CONSTRAINT entry_plans_state_check
  CHECK (state IN ('planned','quoting','submitted','opened','cancelled'));
COMMIT;
