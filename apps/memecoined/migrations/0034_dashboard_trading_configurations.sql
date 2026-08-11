BEGIN;

CREATE TABLE dashboard_trading_configurations (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  strategy_version_id text NOT NULL CHECK (strategy_version_id ~ '^strategy-v[0-9]+\.[0-9]+\.[0-9]+$'),
  maximum_concurrent_positions integer NOT NULL CHECK (maximum_concurrent_positions BETWEEN 1 AND 3),
  risk_per_trade_bps integer NOT NULL CHECK (risk_per_trade_bps BETWEEN 1 AND 50),
  maximum_position_equity_bps integer NOT NULL CHECK (maximum_position_equity_bps BETWEEN 1 AND 500),
  maximum_open_exposure_bps integer NOT NULL CHECK (maximum_open_exposure_bps BETWEEN 1 AND 1000),
  minimum_uncommitted_equity_bps integer NOT NULL CHECK (minimum_uncommitted_equity_bps BETWEEN 5000 AND 10000),
  entry_slippage_bps integer NOT NULL CHECK (entry_slippage_bps BETWEEN 1 AND 150),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (wallet, name),
  CHECK (maximum_position_equity_bps <= maximum_open_exposure_bps)
);

CREATE TABLE dashboard_trading_configuration_audit (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  configuration_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('configuration_created','configuration_updated','configuration_deleted')),
  expected_version bigint,
  resulting_version bigint,
  payload_json jsonb NOT NULL CHECK (jsonb_typeof(payload_json) = 'object'),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX dashboard_trading_configurations_wallet_idx
  ON dashboard_trading_configurations (wallet, updated_at DESC, id);
CREATE INDEX dashboard_trading_configuration_audit_wallet_idx
  ON dashboard_trading_configuration_audit (wallet, occurred_at DESC, id);

COMMIT;
