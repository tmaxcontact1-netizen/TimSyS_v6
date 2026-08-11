BEGIN;

ALTER TABLE tracked_wallets
  ADD COLUMN independent_group_id text;

CREATE INDEX tracked_wallets_independent_group_idx
  ON tracked_wallets (independent_group_id)
  WHERE current_tier = 'tier_b' AND independent_group_id IS NOT NULL;

COMMIT;
