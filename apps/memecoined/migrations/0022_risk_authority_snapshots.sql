BEGIN;

CREATE TABLE risk_authority_snapshots (
  signal_id uuid PRIMARY KEY REFERENCES signals(id),
  mint_address text NOT NULL CHECK (length(btrim(mint_address)) > 0),
  observed_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  portfolio_json jsonb NOT NULL,
  breakers_json jsonb NOT NULL,
  evidence_json jsonb NOT NULL CHECK (jsonb_array_length(evidence_json) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION reject_risk_authority_snapshot_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'risk authority snapshots are immutable';
END;
$$;

CREATE TRIGGER risk_authority_snapshots_append_only
BEFORE UPDATE OR DELETE ON risk_authority_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_risk_authority_snapshot_mutation();

COMMIT;
