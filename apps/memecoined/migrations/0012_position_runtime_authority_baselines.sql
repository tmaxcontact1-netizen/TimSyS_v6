BEGIN;

CREATE TABLE position_runtime_authority_baselines (
  position_id uuid PRIMARY KEY REFERENCES position_runtime_contexts(position_id),
  captured_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER position_runtime_authority_baselines_immutable
BEFORE UPDATE OR DELETE ON position_runtime_authority_baselines
FOR EACH ROW EXECUTE FUNCTION reject_position_runtime_authority_mutation();

COMMIT;
