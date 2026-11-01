BEGIN;

ALTER TABLE paper_fills
  ADD COLUMN execution_fee_raw numeric(78,0) NOT NULL DEFAULT 0
  CHECK (execution_fee_raw >= 0);

COMMIT;
