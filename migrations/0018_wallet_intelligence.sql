BEGIN;

CREATE TABLE tracked_wallets (
  id uuid PRIMARY KEY,
  address text NOT NULL UNIQUE,
  current_tier text NOT NULL CHECK (current_tier IN ('tier_a','tier_b','tier_c','ineligible')),
  qualified_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE wallet_qualification_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES tracked_wallets(id) DEFERRABLE INITIALLY DEFERRED,
  wallet_address text NOT NULL,
  evaluated_at timestamptz NOT NULL,
  tier text NOT NULL CHECK (tier IN ('tier_a','tier_b','tier_c','ineligible')),
  eligible boolean NOT NULL,
  metrics_json jsonb NOT NULL,
  reasons_json jsonb NOT NULL,
  evidence_json jsonb NOT NULL,
  UNIQUE (wallet_id, evaluated_at)
);

CREATE TABLE wallet_confirmations (
  id text PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  evaluated_at timestamptz NOT NULL,
  confirmation text NOT NULL CHECK (confirmation IN ('tier_a','two_tier_b','none')),
  facts_json jsonb NOT NULL
);

CREATE INDEX wallet_confirmations_candidate_time_idx
  ON wallet_confirmations (candidate_id, evaluated_at DESC);

COMMIT;
