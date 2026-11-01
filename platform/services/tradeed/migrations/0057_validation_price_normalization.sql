BEGIN;

ALTER TABLE paper_profile_signal_outcomes
  ADD COLUMN first_signal_input_raw numeric(78,0),
  ADD COLUMN entry_input_raw numeric(78,0),
  ADD COLUMN estimated_to_measured_friction_bps numeric,
  ADD COLUMN realized_to_planned_loss_gap_bps numeric;

COMMIT;
