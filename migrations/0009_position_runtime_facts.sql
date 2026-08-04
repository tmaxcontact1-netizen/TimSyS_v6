BEGIN;

CREATE TABLE position_runtime_facts (
  id uuid PRIMARY KEY,
  position_id uuid NOT NULL,
  checkpoint_revision bigint NOT NULL CHECK (checkpoint_revision >= 0),
  phase text NOT NULL CHECK (phase IN ('monitor', 'reconcile')),
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, checkpoint_revision, phase)
);

CREATE INDEX position_runtime_facts_lookup_idx
  ON position_runtime_facts (position_id, checkpoint_revision, phase);

COMMIT;
