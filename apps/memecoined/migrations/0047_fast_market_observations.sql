BEGIN;

CREATE TABLE paper_fast_market_observations (
  wallet text NOT NULL,
  token_mint text NOT NULL,
  observed_at timestamptz NOT NULL,
  input_amount_raw numeric NOT NULL CHECK (input_amount_raw > 0),
  output_amount_raw numeric NOT NULL CHECK (output_amount_raw > 0),
  quote_fingerprint text NOT NULL,
  PRIMARY KEY (wallet, token_mint, observed_at),
  UNIQUE (wallet, quote_fingerprint)
);

CREATE INDEX paper_fast_market_observations_series_idx
  ON paper_fast_market_observations (wallet, token_mint, observed_at DESC);

CREATE TABLE paper_fast_signal_events (
  wallet text NOT NULL,
  profile_id text NOT NULL,
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  token_mint text NOT NULL,
  observed_at timestamptz NOT NULL,
  eligible boolean NOT NULL,
  signal_json jsonb NOT NULL,
  reasons_json jsonb NOT NULL,
  PRIMARY KEY (wallet, profile_id, token_mint, observed_at)
);

CREATE INDEX paper_fast_signal_events_profile_idx
  ON paper_fast_signal_events (wallet, profile_id, observed_at DESC);

ALTER TABLE paper_profile_candidate_decisions
  ADD COLUMN signal_json jsonb,
  ADD COLUMN signal_observed_at timestamptz;

ALTER TABLE paper_profile_positions
  ADD COLUMN entry_signal_json jsonb,
  ADD COLUMN engine_version text NOT NULL DEFAULT 'snapshot-v1';

ALTER TABLE paper_profile_fills
  ADD COLUMN engine_version text NOT NULL DEFAULT 'snapshot-v1';

COMMIT;
