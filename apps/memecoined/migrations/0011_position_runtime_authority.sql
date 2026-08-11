BEGIN;

CREATE TABLE position_runtime_contexts (
  position_id uuid PRIMARY KEY,
  token_id uuid NOT NULL,
  wallet text NOT NULL CHECK (length(btrim(wallet)) > 0),
  token_mint text NOT NULL CHECK (length(btrim(token_mint)) > 0),
  settlement_mint text NOT NULL CHECK (length(btrim(settlement_mint)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE position_runtime_authority_snapshots (
  id uuid PRIMARY KEY,
  position_id uuid NOT NULL REFERENCES position_runtime_contexts(position_id),
  checkpoint_revision bigint NOT NULL CHECK (checkpoint_revision >= 0),
  phase text NOT NULL CHECK (phase IN ('monitor', 'reconcile')),
  authority_kind text NOT NULL CHECK (authority_kind IN ('wallet', 'security', 'execution')),
  provider text NOT NULL,
  source_key text NOT NULL CHECK (length(btrim(source_key)) > 0),
  observed_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, checkpoint_revision, phase, authority_kind)
);

CREATE FUNCTION reject_position_runtime_authority_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'position runtime authority is immutable';
END;
$$;

CREATE TRIGGER position_runtime_contexts_immutable
BEFORE UPDATE OR DELETE ON position_runtime_contexts
FOR EACH ROW EXECUTE FUNCTION reject_position_runtime_authority_mutation();

CREATE TRIGGER position_runtime_authority_snapshots_immutable
BEFORE UPDATE OR DELETE ON position_runtime_authority_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_position_runtime_authority_mutation();

COMMIT;
