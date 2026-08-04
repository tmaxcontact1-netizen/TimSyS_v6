BEGIN;
ALTER TABLE orders ADD COLUMN wallet_address text NOT NULL;
CREATE TABLE entry_submission_attempts (
  order_id uuid PRIMARY KEY REFERENCES orders(id),
  delivery_id text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('signed','submitted')),
  unsigned_fingerprint text NOT NULL,
  signed_fingerprint text NOT NULL,
  signature text NOT NULL UNIQUE,
  signed_transaction_base64 text NOT NULL,
  provider text CHECK (provider IN ('helius','solana_rpc')),
  created_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  CHECK ((state='signed' AND provider IS NULL AND acknowledged_at IS NULL)
      OR (state='submitted' AND provider IS NOT NULL AND acknowledged_at IS NOT NULL))
);
COMMIT;
