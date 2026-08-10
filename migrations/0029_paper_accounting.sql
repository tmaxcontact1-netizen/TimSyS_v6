BEGIN;

CREATE TABLE paper_accounts (
  wallet text PRIMARY KEY CHECK (length(btrim(wallet)) > 0),
  settlement_mint text NOT NULL CHECK (length(btrim(settlement_mint)) > 0),
  opened_at timestamptz NOT NULL,
  initial_cash_raw numeric(78,0) NOT NULL CHECK (initial_cash_raw >= 0)
);

CREATE TABLE paper_cash_events (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  event_type text NOT NULL CHECK (event_type IN ('deposit','buy','sell')),
  amount_raw numeric(78,0) NOT NULL CHECK (amount_raw > 0),
  occurred_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (wallet, content_hash)
);

CREATE TABLE paper_fills (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  side text NOT NULL CHECK (side IN ('buy','sell')),
  token_mint text NOT NULL CHECK (length(btrim(token_mint)) > 0),
  token_amount_raw numeric(78,0) NOT NULL CHECK (token_amount_raw > 0),
  settlement_amount_raw numeric(78,0) NOT NULL CHECK (settlement_amount_raw > 0),
  quoted_at timestamptz NOT NULL,
  filled_at timestamptz NOT NULL CHECK (filled_at >= quoted_at),
  quote_fingerprint text NOT NULL CHECK (length(btrim(quote_fingerprint)) > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (wallet, quote_fingerprint)
);

CREATE TABLE paper_position_lots (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  token_mint text NOT NULL CHECK (length(btrim(token_mint)) > 0),
  source_fill_id uuid NOT NULL UNIQUE REFERENCES paper_fills(id),
  acquired_amount_raw numeric(78,0) NOT NULL CHECK (acquired_amount_raw > 0),
  current_amount_raw numeric(78,0) NOT NULL CHECK (current_amount_raw >= 0),
  cost_raw numeric(78,0) NOT NULL CHECK (cost_raw > 0),
  remaining_cost_raw numeric(78,0) NOT NULL CHECK (remaining_cost_raw >= 0),
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  CHECK (current_amount_raw <= acquired_amount_raw),
  CHECK (remaining_cost_raw <= cost_raw),
  CHECK ((current_amount_raw = 0 AND remaining_cost_raw = 0 AND closed_at IS NOT NULL)
      OR (current_amount_raw > 0 AND closed_at IS NULL))
);

CREATE TABLE paper_lot_disposals (
  fill_id uuid NOT NULL REFERENCES paper_fills(id),
  lot_id uuid NOT NULL REFERENCES paper_position_lots(id),
  token_amount_raw numeric(78,0) NOT NULL CHECK (token_amount_raw > 0),
  released_cost_raw numeric(78,0) NOT NULL CHECK (released_cost_raw >= 0),
  PRIMARY KEY (fill_id, lot_id)
);

CREATE INDEX paper_lots_open_idx
  ON paper_position_lots (wallet, token_mint, opened_at, id)
  WHERE current_amount_raw > 0;

COMMIT;
