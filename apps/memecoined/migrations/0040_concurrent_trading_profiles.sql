BEGIN;

CREATE TABLE paper_profile_activations (
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  profile_id text NOT NULL CHECK (profile_id IN (
    'whale_tracker','fast_furious','slow_steady','trend_detector',
    'capital_preservation','signal_consensus'
  )),
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL CHECK (mode IN ('observe','recommend','automatic_paper')),
  allocation_bps integer NOT NULL CHECK (allocation_bps BETWEEN 0 AND 10000),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (wallet, profile_id),
  CHECK (NOT enabled OR allocation_bps > 0)
);

CREATE TABLE paper_profile_activation_audit (
  id uuid PRIMARY KEY,
  wallet text NOT NULL REFERENCES paper_accounts(wallet),
  profile_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('profile_configured','profile_enabled','profile_disabled')),
  expected_version bigint NOT NULL,
  resulting_version bigint NOT NULL,
  payload_json jsonb NOT NULL CHECK (jsonb_typeof(payload_json) = 'object'),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX paper_profile_activations_enabled_idx
  ON paper_profile_activations (wallet, enabled, profile_id);
CREATE INDEX paper_profile_activation_audit_wallet_idx
  ON paper_profile_activation_audit (wallet, occurred_at DESC, id);

COMMIT;
