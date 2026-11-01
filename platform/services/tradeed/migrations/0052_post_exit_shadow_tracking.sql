BEGIN;

CREATE TABLE IF NOT EXISTS paper_profile_post_exit_observations (
  wallet text NOT NULL,
  exit_fill_id uuid NOT NULL REFERENCES paper_profile_fills(id) ON DELETE CASCADE,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  exit_reason text NOT NULL,
  exit_at timestamptz NOT NULL,
  horizon_minutes integer NOT NULL CHECK (horizon_minutes IN (5,15,30,60,180)),
  observed_at timestamptz NOT NULL,
  entry_cost_raw numeric(78,0) NOT NULL CHECK (entry_cost_raw > 0),
  exit_value_raw numeric(78,0) NOT NULL CHECK (exit_value_raw >= 0),
  observed_value_raw numeric(78,0) NOT NULL CHECK (observed_value_raw >= 0),
  target_bps integer,
  stop_bps integer,
  quote_fingerprint text NOT NULL,
  PRIMARY KEY (wallet,exit_fill_id,horizon_minutes)
);

CREATE INDEX IF NOT EXISTS paper_profile_post_exit_profile_idx
  ON paper_profile_post_exit_observations(wallet,profile_id,exit_at DESC);

CREATE INDEX IF NOT EXISTS paper_profile_post_exit_token_idx
  ON paper_profile_post_exit_observations(wallet,token_mint,exit_at DESC);

COMMIT;
