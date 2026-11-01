BEGIN;

CREATE TABLE operator_approvals (
  id uuid PRIMARY KEY,
  action_type text NOT NULL CHECK (action_type IN
    ('entry','position_close','emergency_action','configuration_activation')),
  target_type text NOT NULL CHECK (length(btrim(target_type)) > 0),
  target_id text NOT NULL CHECK (length(btrim(target_id)) > 0),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  eligibility_hash text NOT NULL CHECK (eligibility_hash ~ '^[0-9a-f]{64}$'),
  quote_fingerprint text,
  nonce_hash text NOT NULL UNIQUE CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN
    ('pending','approved','rejected','consumed','expired','cancelled')),
  requested_by text NOT NULL CHECK (length(btrim(requested_by)) > 0),
  requested_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > requested_at),
  decided_by text,
  decided_at timestamptz,
  consumed_at timestamptz,
  reason text,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  CHECK ((state IN ('approved','rejected','consumed')) = (decided_by IS NOT NULL)),
  CHECK ((state IN ('approved','rejected','consumed')) = (decided_at IS NOT NULL)),
  CHECK ((state='consumed') = (consumed_at IS NOT NULL)),
  UNIQUE (action_type,target_type,target_id,payload_hash)
);

CREATE INDEX operator_approvals_pending_idx
  ON operator_approvals (expires_at,requested_at,id) WHERE state IN ('pending','approved');

CREATE TABLE operator_approval_events (
  id uuid PRIMARY KEY,
  approval_id uuid NOT NULL REFERENCES operator_approvals(id),
  event_type text NOT NULL CHECK (event_type IN
    ('requested','approved','rejected','consumed','expired','cancelled')),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  occurred_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX operator_approval_events_order_idx
  ON operator_approval_events (approval_id,occurred_at,id);

COMMIT;
