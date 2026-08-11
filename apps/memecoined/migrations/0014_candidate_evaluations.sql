BEGIN;
CREATE TABLE rule_evaluations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES candidates(id),
  evaluation_run_id text NOT NULL, rule_id text NOT NULL, outcome text NOT NULL CHECK (outcome IN ('pass','fail','unknown','not_applicable')),
  reason text NOT NULL, measurements_json jsonb NOT NULL, evidence_json jsonb NOT NULL, evaluated_at timestamptz NOT NULL,
  UNIQUE (evaluation_run_id, rule_id)
);
CREATE TABLE score_breakdowns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES candidates(id), evaluation_run_id text NOT NULL UNIQUE,
  breakdown_json jsonb NOT NULL, total_score integer NOT NULL CHECK (total_score BETWEEN 0 AND 95), evaluated_at timestamptz NOT NULL
);
CREATE TABLE signals (
  id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES candidates(id), state text NOT NULL CHECK (state IN ('eligible','approval_pending','expired','converted')),
  strategy_version_id text NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz, eligibility_hash text NOT NULL UNIQUE
);
CREATE TABLE rejections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES candidates(id), evaluation_run_id text NOT NULL,
  rule_id text NOT NULL, rejected_at timestamptz NOT NULL, UNIQUE (evaluation_run_id, rule_id)
);
COMMIT;
