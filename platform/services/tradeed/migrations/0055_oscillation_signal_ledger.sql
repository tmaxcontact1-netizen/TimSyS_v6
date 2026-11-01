BEGIN;

ALTER TABLE paper_profile_activations
  DROP CONSTRAINT IF EXISTS paper_profile_activations_profile_id_check;
ALTER TABLE paper_profile_activations
  ADD CONSTRAINT paper_profile_activations_profile_id_check CHECK (profile_id IN (
    'whale_tracker','fast_furious','slow_steady','trend_detector','capital_preservation',
    'signal_consensus','breakout_retest','liquidity_expansion','social_catalyst',
    'recovery_reversal','launch_transition','scalper','oscillation_trader','benchmark_buy_hold',
    'benchmark_momentum','benchmark_ema_cross','benchmark_rsi_reversal',
    'benchmark_macd_trend','benchmark_bollinger_reversion','benchmark_donchian_breakout',
    'benchmark_volume_breakout','benchmark_atr_trend'
  ));

ALTER TABLE paper_profile_accounts
  DROP CONSTRAINT IF EXISTS paper_profile_accounts_profile_id_check;
ALTER TABLE paper_profile_accounts
  ADD CONSTRAINT paper_profile_accounts_profile_id_check CHECK (profile_id IN (
    'whale_tracker','fast_furious','slow_steady','trend_detector','capital_preservation',
    'signal_consensus','breakout_retest','liquidity_expansion','social_catalyst',
    'recovery_reversal','launch_transition','scalper','oscillation_trader','benchmark_buy_hold',
    'benchmark_momentum','benchmark_ema_cross','benchmark_rsi_reversal',
    'benchmark_macd_trend','benchmark_bollinger_reversion','benchmark_donchian_breakout',
    'benchmark_volume_breakout','benchmark_atr_trend'
  ));

INSERT INTO paper_profile_activations
  (wallet,profile_id,enabled,mode,allocation_bps,version,created_at,updated_at)
SELECT wallet,'oscillation_trader',false,'observe',1250,1,now(),now()
FROM paper_accounts ON CONFLICT (wallet,profile_id) DO NOTHING;

-- A candidate is discovery provenance. A signal is one immutable market event.
-- Keeping these identities separate permits legitimate rapid re-entry without
-- allowing one signal to fan out through duplicate candidate rows.
CREATE TABLE paper_profile_signals (
  id uuid PRIMARY KEY,
  wallet text NOT NULL,
  profile_id text NOT NULL,
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  token_mint text NOT NULL,
  signal_type text,
  observed_at timestamptz NOT NULL,
  engine_version text NOT NULL,
  eligible boolean NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  metrics_json jsonb NOT NULL,
  gates_json jsonb NOT NULL,
  rejection_reasons_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (wallet,profile_id,token_mint,observed_at,signal_type)
);
CREATE INDEX paper_profile_signals_analysis_idx
  ON paper_profile_signals(wallet,profile_id,observed_at DESC,eligible);

CREATE TABLE paper_profile_entry_intents (
  signal_id uuid PRIMARY KEY REFERENCES paper_profile_signals(id),
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  state text NOT NULL CHECK (state IN
    ('pending','leased','retrying','entered','closed','rejected','expired','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  last_error text,
  entry_fill_id uuid REFERENCES paper_profile_fills(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX paper_profile_entry_intents_one_live_token_idx
  ON paper_profile_entry_intents(wallet,profile_id,token_mint)
  WHERE state IN ('pending','leased','retrying','entered');
CREATE INDEX paper_profile_entry_intents_due_idx
  ON paper_profile_entry_intents(wallet,next_attempt_at)
  WHERE state IN ('pending','retrying');

ALTER TABLE paper_profile_candidate_decisions
  ADD COLUMN signal_id uuid REFERENCES paper_profile_signals(id);

-- One row exists for every signal, including rejection and expiry. Entry and
-- exit facts are added later; the originating metrics remain immutable.
CREATE TABLE paper_profile_signal_outcomes (
  signal_id uuid PRIMARY KEY REFERENCES paper_profile_signals(id),
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN
    ('observed','rejected','expired','entered','closed')),
  entry_fill_id uuid REFERENCES paper_profile_fills(id),
  exit_fill_id uuid REFERENCES paper_profile_fills(id),
  entered_at timestamptz,
  exited_at timestamptz,
  exit_reason text,
  planned_target_bps integer,
  planned_stop_bps integer,
  estimated_friction_bps integer,
  realized_gross_bps numeric,
  realized_net_bps numeric,
  realized_friction_bps numeric,
  maximum_favorable_excursion_bps numeric,
  maximum_adverse_excursion_bps numeric,
  holding_seconds integer,
  target_hit boolean,
  stop_hit boolean,
  forward_returns_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX paper_profile_signal_outcomes_validation_idx
  ON paper_profile_signal_outcomes(wallet,profile_id,lifecycle_state,updated_at DESC);

COMMIT;
