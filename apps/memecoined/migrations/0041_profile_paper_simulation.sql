BEGIN;

CREATE TABLE paper_profile_accounts (
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  profile_id text NOT NULL CHECK (profile_id IN (
    'whale_tracker','fast_furious','slow_steady','trend_detector',
    'capital_preservation','signal_consensus'
  )),
  allocation_bps integer NOT NULL CHECK (allocation_bps BETWEEN 1 AND 10000),
  initial_cash_raw numeric(78,0) NOT NULL CHECK (initial_cash_raw > 0),
  cash_raw numeric(78,0) NOT NULL CHECK (cash_raw >= 0),
  realized_pnl_raw numeric(78,0) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (wallet,profile_id)
);

CREATE TABLE paper_profile_candidate_decisions (
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  profile_id text NOT NULL,
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  mode text NOT NULL CHECK (mode IN ('observe','recommend','automatic_paper')),
  eligible boolean NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 95),
  reasons_json jsonb NOT NULL CHECK (jsonb_typeof(reasons_json)='array'),
  evaluated_at timestamptz NOT NULL,
  PRIMARY KEY (wallet,profile_id,candidate_id),
  FOREIGN KEY (wallet,profile_id) REFERENCES paper_profile_accounts(wallet,profile_id)
);

CREATE TABLE paper_profile_positions (
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  token_amount_raw numeric(78,0) NOT NULL CHECK (token_amount_raw > 0),
  cost_raw numeric(78,0) NOT NULL CHECK (cost_raw > 0),
  current_value_raw numeric(78,0) NOT NULL CHECK (current_value_raw >= 0),
  high_water_raw numeric(78,0) NOT NULL CHECK (high_water_raw > 0),
  opened_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (wallet,profile_id,token_mint),
  FOREIGN KEY (wallet,profile_id) REFERENCES paper_profile_accounts(wallet,profile_id)
);

CREATE TABLE paper_profile_fills (
  id uuid PRIMARY KEY,
  wallet text NOT NULL,
  profile_id text NOT NULL,
  candidate_id uuid REFERENCES candidates(id),
  side text NOT NULL CHECK (side IN ('buy','sell')),
  token_mint text NOT NULL,
  token_amount_raw numeric(78,0) NOT NULL CHECK (token_amount_raw > 0),
  settlement_amount_raw numeric(78,0) NOT NULL CHECK (settlement_amount_raw > 0),
  execution_fee_raw numeric(78,0) NOT NULL CHECK (execution_fee_raw >= 0),
  quote_fingerprint text NOT NULL,
  reason text NOT NULL,
  quoted_at timestamptz NOT NULL,
  filled_at timestamptz NOT NULL CHECK (filled_at >= quoted_at),
  FOREIGN KEY (wallet,profile_id) REFERENCES paper_profile_accounts(wallet,profile_id),
  UNIQUE (wallet,profile_id,quote_fingerprint)
);

CREATE INDEX paper_profile_decisions_time_idx
  ON paper_profile_candidate_decisions (wallet,evaluated_at DESC,profile_id);
CREATE INDEX paper_profile_fills_time_idx
  ON paper_profile_fills (wallet,filled_at DESC,profile_id);

COMMIT;
