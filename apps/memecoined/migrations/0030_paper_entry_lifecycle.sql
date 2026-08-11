BEGIN;

CREATE TABLE paper_entry_executions (
  signal_id uuid PRIMARY KEY REFERENCES signals(id),
  risk_run_id text NOT NULL UNIQUE REFERENCES risk_decisions(risk_run_id),
  fill_id uuid NOT NULL UNIQUE REFERENCES paper_fills(id),
  executed_at timestamptz NOT NULL
);

COMMIT;
