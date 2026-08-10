BEGIN;

CREATE TABLE paper_position_close_requests (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  token_mint text NOT NULL,
  expected_open_amount_raw numeric(78,0) NOT NULL CHECK (expected_open_amount_raw > 0),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','fulfilled')),
  requested_at timestamptz NOT NULL,
  fulfilled_at timestamptz,
  CHECK ((state='pending' AND fulfilled_at IS NULL) OR (state='fulfilled' AND fulfilled_at IS NOT NULL))
);

CREATE UNIQUE INDEX paper_position_close_requests_pending_idx
  ON paper_position_close_requests (wallet,token_mint) WHERE state='pending';

CREATE TABLE paper_operator_control_audit (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  action text NOT NULL CHECK (action IN ('entry_cancelled','position_close_requested','position_close_fulfilled')),
  target text NOT NULL,
  payload_json jsonb NOT NULL CHECK (jsonb_typeof(payload_json)='object'),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX paper_operator_control_audit_wallet_idx
  ON paper_operator_control_audit (wallet,occurred_at DESC,id);

COMMIT;
