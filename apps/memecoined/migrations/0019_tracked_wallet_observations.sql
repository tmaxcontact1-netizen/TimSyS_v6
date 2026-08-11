BEGIN;

CREATE TABLE tracked_wallet_cursors (
  wallet_id uuid PRIMARY KEY REFERENCES tracked_wallets(id),
  last_signature text,
  observed_at timestamptz NOT NULL
);

CREATE TABLE tracked_wallet_purchase_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES tracked_wallets(id),
  signature text NOT NULL,
  mint text NOT NULL,
  purchased_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL CHECK (observed_at >= purchased_at),
  slot bigint NOT NULL CHECK (slot >= 0),
  acquired_amount_raw numeric(78,0) NOT NULL CHECK (acquired_amount_raw > 0),
  native_spent_lamports numeric(78,0) NOT NULL CHECK (native_spent_lamports >= 0),
  evidence_json jsonb NOT NULL,
  UNIQUE (wallet_id, signature, mint)
);

CREATE INDEX tracked_wallet_purchase_mint_time_idx
  ON tracked_wallet_purchase_observations (mint, purchased_at DESC);

COMMIT;
