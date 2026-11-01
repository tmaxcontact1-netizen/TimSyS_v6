BEGIN;

-- Admission is a Boolean decision. The historic integer score remains only for
-- migration compatibility and is no longer read by allocation or the UI.
ALTER TABLE paper_profile_signals
  ADD COLUMN qualified boolean;
UPDATE paper_profile_signals SET qualified=eligible WHERE qualified IS NULL;
ALTER TABLE paper_profile_signals ALTER COLUMN qualified SET NOT NULL;

ALTER TABLE paper_profile_regime_watches
  ADD COLUMN capacity_entry_depth_bps numeric NOT NULL DEFAULT 0,
  ADD COLUMN capacity_spread_bps numeric,
  ADD COLUMN capacity_buy_pressure numeric;

CREATE TABLE paper_conviction_score_evaluations (
  id uuid PRIMARY KEY,
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  signal_id uuid NOT NULL UNIQUE REFERENCES paper_profile_signals(id),
  wallet text NOT NULL,
  token_mint text NOT NULL,
  observed_at timestamptz NOT NULL,
  qualified boolean NOT NULL,
  total_score integer NOT NULL CHECK(total_score BETWEEN 0 AND 100),
  entry_depth_points integer NOT NULL CHECK(entry_depth_points BETWEEN 0 AND 35),
  spread_points integer NOT NULL CHECK(spread_points BETWEEN 0 AND 25),
  buy_pressure_points integer NOT NULL CHECK(buy_pressure_points BETWEEN 0 AND 20),
  session_track_points integer NOT NULL CHECK(session_track_points BETWEEN 0 AND 20),
  entry_distance_bps numeric NOT NULL,
  spread_bps numeric NOT NULL,
  buy_pressure numeric,
  session_token_net_bps numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paper_conviction_score_evaluations_epoch_idx
  ON paper_conviction_score_evaluations(epoch_id,observed_at DESC);

-- Existing wallets must see the dormant experiment without activating it.
INSERT INTO paper_profile_activations
  (wallet,profile_id,enabled,mode,allocation_bps,version,created_at,updated_at)
SELECT DISTINCT wallet,'conviction_scale',false,'observe',0,1,now(),now()
  FROM paper_profile_activations
ON CONFLICT(wallet,profile_id) DO NOTHING;

COMMIT;
