BEGIN;

CREATE TABLE position_observations (
  id uuid PRIMARY KEY,
  position_id uuid NOT NULL,
  observation_kind text NOT NULL CHECK (
    observation_kind IN ('market', 'chain', 'wallet', 'security', 'execution')
  ),
  provider text NOT NULL,
  source_key text NOT NULL,
  observed_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  payload_json jsonb NOT NULL,
  UNIQUE (provider, source_key, content_hash)
);

CREATE INDEX position_observations_position_time_idx
  ON position_observations (position_id, observed_at, id);

CREATE FUNCTION reject_position_observation_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'position observations are immutable';
END;
$$;

CREATE TRIGGER position_observations_append_only
BEFORE UPDATE OR DELETE ON position_observations
FOR EACH ROW EXECUTE FUNCTION reject_position_observation_mutation();

CREATE TABLE position_runtime_fact_observations (
  runtime_fact_id uuid NOT NULL REFERENCES position_runtime_facts(id),
  observation_id uuid NOT NULL REFERENCES position_observations(id),
  PRIMARY KEY (runtime_fact_id, observation_id)
);

COMMIT;
