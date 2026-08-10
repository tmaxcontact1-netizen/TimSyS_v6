BEGIN;

CREATE TABLE paper_position_work (
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  token_mint text NOT NULL,
  available_at timestamptz NOT NULL,
  lease_owner text,
  lease_acquired_at timestamptz,
  lease_expires_at timestamptz,
  last_monitored_at timestamptz,
  last_error text,
  PRIMARY KEY (wallet, token_mint),
  CHECK ((lease_owner IS NULL AND lease_acquired_at IS NULL AND lease_expires_at IS NULL)
      OR (lease_owner IS NOT NULL AND lease_acquired_at IS NOT NULL AND lease_expires_at IS NOT NULL))
);

CREATE TABLE paper_realized_performance (
  fill_id uuid PRIMARY KEY REFERENCES paper_fills(id),
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  token_mint text NOT NULL,
  proceeds_raw numeric(78,0) NOT NULL CHECK (proceeds_raw > 0),
  released_cost_raw numeric(78,0) NOT NULL CHECK (released_cost_raw >= 0),
  realized_pnl_raw numeric(78,0) NOT NULL,
  realized_at timestamptz NOT NULL
);

CREATE INDEX paper_position_work_due_idx ON paper_position_work (available_at)
  WHERE lease_owner IS NULL;
CREATE INDEX paper_realized_performance_wallet_idx
  ON paper_realized_performance (wallet, realized_at, fill_id);

COMMIT;
