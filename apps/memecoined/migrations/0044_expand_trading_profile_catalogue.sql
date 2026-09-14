BEGIN;

ALTER TABLE paper_profile_activations
  DROP CONSTRAINT IF EXISTS paper_profile_activations_profile_id_check;

ALTER TABLE paper_profile_activations
  ADD CONSTRAINT paper_profile_activations_profile_id_check CHECK (profile_id IN (
    'whale_tracker','fast_furious','slow_steady','trend_detector','capital_preservation',
    'signal_consensus','breakout_retest','liquidity_expansion','social_catalyst',
    'recovery_reversal','launch_transition','scalper'
  ));

ALTER TABLE paper_profile_accounts
  DROP CONSTRAINT IF EXISTS paper_profile_accounts_profile_id_check;

ALTER TABLE paper_profile_accounts
  ADD CONSTRAINT paper_profile_accounts_profile_id_check CHECK (profile_id IN (
    'whale_tracker','fast_furious','slow_steady','trend_detector','capital_preservation',
    'signal_consensus','breakout_retest','liquidity_expansion','social_catalyst',
    'recovery_reversal','launch_transition','scalper'
  ));

INSERT INTO paper_profile_activations
  (wallet,profile_id,enabled,mode,allocation_bps,version,created_at,updated_at)
SELECT accounts.wallet, profiles.profile_id, false, 'observe', 0, 1, now(), now()
FROM paper_accounts accounts
CROSS JOIN (VALUES
  ('breakout_retest'),('liquidity_expansion'),('social_catalyst'),
  ('recovery_reversal'),('launch_transition'),('scalper')
) profiles(profile_id)
ON CONFLICT (wallet,profile_id) DO NOTHING;

COMMIT;
