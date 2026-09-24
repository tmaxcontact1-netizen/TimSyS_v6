BEGIN;

ALTER TABLE paper_profile_positions
  ADD COLUMN entry_fee_raw numeric(78,0) NOT NULL DEFAULT 0
    CHECK (entry_fee_raw >= 0);

ALTER TABLE paper_profile_fills
  ADD COLUMN decision_snapshot_json jsonb;

COMMIT;
