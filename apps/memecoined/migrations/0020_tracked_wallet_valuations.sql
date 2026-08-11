BEGIN;

ALTER TABLE tracked_wallet_purchase_observations
  ADD COLUMN token_decimals smallint CHECK (token_decimals BETWEEN 0 AND 18);

CREATE TABLE tracked_wallet_purchase_valuations (
  observation_id bigint PRIMARY KEY REFERENCES tracked_wallet_purchase_observations(id),
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  valued_at timestamptz NOT NULL,
  price_usd numeric NOT NULL CHECK (price_usd > 0),
  liquidity_usd numeric NOT NULL CHECK (liquidity_usd > 0),
  purchase_value_usd numeric NOT NULL CHECK (purchase_value_usd > 0),
  acquired_amount_raw numeric(78,0) NOT NULL CHECK (acquired_amount_raw > 0),
  retained_amount_raw numeric(78,0) NOT NULL CHECK (retained_amount_raw >= 0),
  retained_percentage numeric NOT NULL CHECK (retained_percentage BETWEEN 0 AND 100),
  market_evidence_json jsonb NOT NULL,
  balance_evidence_json jsonb NOT NULL
);

CREATE INDEX tracked_wallet_purchase_valuations_candidate_time_idx
  ON tracked_wallet_purchase_valuations (candidate_id, valued_at DESC);

COMMIT;
