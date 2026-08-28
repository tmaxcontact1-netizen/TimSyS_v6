BEGIN;

CREATE TABLE telegram_operator_updates (
  update_id bigint PRIMARY KEY CHECK (update_id >= 0),
  chat_id text NOT NULL,
  user_id text NOT NULL,
  command_hash text NOT NULL CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('processing','completed','failed')),
  result text,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE operator_runtime_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  entry_blocked boolean NOT NULL DEFAULT false,
  reason text,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  CHECK (entry_blocked OR reason IS NULL)
);

CREATE TABLE operator_runtime_control_events (
  id uuid PRIMARY KEY,
  entry_blocked boolean NOT NULL,
  reason text,
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$')
);

COMMIT;
