BEGIN;

CREATE TABLE IF NOT EXISTS paper_profile_regime_watches (
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  qualified_at timestamptz NOT NULL,
  last_evaluated_at timestamptz NOT NULL,
  regime_score integer NOT NULL CHECK (regime_score BETWEEN 0 AND 100),
  consecutive_qualifications integer NOT NULL DEFAULT 1 CHECK (consecutive_qualifications >= 0),
  below_floor_cycles integer NOT NULL DEFAULT 0 CHECK (below_floor_cycles >= 0),
  pinned boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','removed')),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (wallet,profile_id,token_mint)
);

CREATE INDEX IF NOT EXISTS paper_profile_regime_watch_schedule
  ON paper_profile_regime_watches(wallet,pinned,last_evaluated_at)
  WHERE status='active';

ALTER TABLE paper_profile_signal_outcomes
  ADD COLUMN first_signal_output_raw numeric(78,0),
  ADD COLUMN entry_output_raw numeric(78,0),
  ADD COLUMN entry_to_first_signal_bps numeric,
  ADD COLUMN planned_loss_bps numeric,
  ADD COLUMN realized_loss_bps numeric,
  ADD COLUMN measured_round_trip_bps numeric;

COMMIT;
