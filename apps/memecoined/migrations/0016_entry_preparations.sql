BEGIN;
CREATE TABLE entry_gate_evaluations (
  order_id uuid PRIMARY KEY, signal_id uuid NOT NULL UNIQUE REFERENCES signals(id),
  approved boolean NOT NULL, snapshot_json jsonb NOT NULL, decision_json jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL
);
CREATE TABLE orders (
  id uuid PRIMARY KEY, signal_id uuid NOT NULL UNIQUE REFERENCES signals(id),
  side text NOT NULL CHECK (side IN ('buy','sell')),
  state text NOT NULL CHECK (state IN ('approved','signing','submitted','confirmed','reconciled','failed','cancelled')),
  intended_input_amount numeric NOT NULL CHECK (intended_input_amount > 0),
  quote_fingerprint text NOT NULL, transaction_fingerprint text NOT NULL,
  transaction_base64 text NOT NULL, last_valid_block_height numeric NOT NULL CHECK (last_valid_block_height >= 0),
  prioritization_fee_lamports numeric NOT NULL CHECK (prioritization_fee_lamports >= 0),
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);
COMMIT;
