BEGIN;
CREATE TABLE wallet_transaction_observations (
  wallet text NOT NULL,
  signature text NOT NULL,
  occurred_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  slot bigint NOT NULL CHECK (slot >= 0),
  successful boolean NOT NULL,
  evidence_json jsonb NOT NULL,
  PRIMARY KEY (wallet, signature)
);
CREATE TABLE wallet_transaction_history_coverage (
  wallet text PRIMARY KEY,
  coverage_started_at timestamptz NOT NULL,
  observed_through_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE exit_submission_authority (
  position_id uuid NOT NULL,
  delivery_id text PRIMARY KEY,
  signature text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('helius','solana_rpc')),
  acknowledged_at timestamptz NOT NULL
);
COMMIT;
