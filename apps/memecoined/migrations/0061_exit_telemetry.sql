BEGIN;

ALTER TABLE paper_profile_signal_outcomes
  ADD COLUMN IF NOT EXISTS high_water_raw numeric CHECK (high_water_raw IS NULL OR high_water_raw >= 0),
  ADD COLUMN IF NOT EXISTS breakeven_armed boolean NOT NULL DEFAULT false;

COMMIT;
