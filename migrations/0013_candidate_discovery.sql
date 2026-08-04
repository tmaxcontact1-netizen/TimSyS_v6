BEGIN;

CREATE TABLE candidates (
  id uuid PRIMARY KEY,
  token_id uuid NOT NULL,
  mint_address text NOT NULL,
  active_dedup_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('discovered', 'normalizing', 'evaluating', 'rejected', 'eligible', 'approval_pending', 'expired', 'converted')),
  first_seen_at timestamptz NOT NULL,
  last_evaluated_at timestamptz,
  strategy_version_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);

CREATE TABLE candidate_sources (
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  provider_id text NOT NULL,
  source_reference text NOT NULL,
  observed_at timestamptz NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, provider_id, source_reference)
);

CREATE INDEX candidates_state_seen_idx ON candidates (state, first_seen_at, id);

COMMIT;
