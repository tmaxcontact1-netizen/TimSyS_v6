BEGIN;

CREATE TABLE paper_exit_evaluations (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  token_mint text NOT NULL,
  evaluated_at timestamptz NOT NULL,
  open_amount_raw numeric(78,0) NOT NULL CHECK (open_amount_raw > 0),
  executable_value_sol numeric NOT NULL CHECK (executable_value_sol >= 0),
  action text NOT NULL CHECK (action IN ('none','partial','full')),
  rule_id text,
  requested_amount_raw numeric(78,0) NOT NULL CHECK (requested_amount_raw >= 0),
  evidence_json jsonb NOT NULL,
  UNIQUE (wallet,token_mint,evaluated_at)
);

CREATE INDEX paper_exit_evaluations_position_idx
  ON paper_exit_evaluations (wallet,token_mint,evaluated_at);

COMMIT;
