BEGIN;
CREATE TABLE risk_decisions (
  risk_run_id text PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES signals(id),
  approved boolean NOT NULL,
  position_size_sol numeric,
  sizing_json jsonb NOT NULL,
  breakers_json jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL,
  CHECK ((approved AND position_size_sol > 0) OR (NOT approved AND position_size_sol IS NULL))
);
CREATE UNIQUE INDEX risk_decisions_signal_idx ON risk_decisions (signal_id);
CREATE TABLE entry_plans (
  signal_id uuid PRIMARY KEY REFERENCES signals(id),
  risk_run_id text NOT NULL UNIQUE REFERENCES risk_decisions(risk_run_id),
  position_size_sol numeric NOT NULL CHECK (position_size_sol > 0),
  state text NOT NULL CHECK (state IN ('planned','quoting','submitted','cancelled')),
  created_at timestamptz NOT NULL
);
COMMIT;
