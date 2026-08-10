BEGIN;

CREATE TABLE dashboard_watchlists (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (wallet, name)
);

CREATE TABLE dashboard_watchlist_tokens (
  watchlist_id uuid NOT NULL REFERENCES dashboard_watchlists(id) ON DELETE CASCADE,
  token_mint text NOT NULL CHECK (token_mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  added_at timestamptz NOT NULL,
  PRIMARY KEY (watchlist_id, token_mint)
);

CREATE TABLE dashboard_mutation_audit (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  watchlist_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('watchlist_created','watchlist_renamed','watchlist_deleted','token_added','token_removed')),
  expected_version bigint,
  resulting_version bigint,
  payload_json jsonb NOT NULL CHECK (jsonb_typeof(payload_json) = 'object'),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX dashboard_watchlists_wallet_idx
  ON dashboard_watchlists (wallet, updated_at DESC, id);
CREATE INDEX dashboard_mutation_audit_wallet_idx
  ON dashboard_mutation_audit (wallet, occurred_at DESC, id);

COMMIT;
