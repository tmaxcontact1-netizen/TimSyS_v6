BEGIN;

CREATE TABLE reconciliation_failure_events (
  position_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  attempt integer NOT NULL CHECK (attempt > 0),
  failure_json jsonb NOT NULL,
  PRIMARY KEY (position_id, attempt)
);

CREATE INDEX reconciliation_failure_events_time_idx
  ON reconciliation_failure_events (occurred_at DESC, position_id, attempt);

CREATE TABLE provider_disagreement_intervals (
  authority_key text NOT NULL CHECK (length(btrim(authority_key)) > 0),
  wallet text NOT NULL CHECK (length(btrim(wallet)) > 0),
  began_at timestamptz NOT NULL,
  resolved_at timestamptz,
  opening_evidence_json jsonb NOT NULL,
  closing_evidence_json jsonb,
  PRIMARY KEY (authority_key, began_at),
  CHECK (resolved_at IS NULL OR resolved_at >= began_at),
  CHECK ((resolved_at IS NULL) = (closing_evidence_json IS NULL))
);

CREATE UNIQUE INDEX provider_disagreement_one_open_idx
  ON provider_disagreement_intervals (authority_key, wallet)
  WHERE resolved_at IS NULL;

CREATE INDEX provider_disagreement_wallet_time_idx
  ON provider_disagreement_intervals (wallet, began_at DESC);

COMMIT;
