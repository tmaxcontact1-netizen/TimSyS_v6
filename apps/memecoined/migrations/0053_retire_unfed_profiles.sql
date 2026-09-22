BEGIN;

-- Preserve historical decisions and fills, but free allocations and prevent
-- unsupported strategies from remaining enabled after an update.
UPDATE paper_profile_activations
   SET enabled = false,
       mode = 'observe',
       allocation_bps = 0,
       version = version + 1,
       updated_at = now()
 WHERE profile_id IN ('whale_tracker', 'social_catalyst')
   AND (enabled OR mode <> 'observe' OR allocation_bps <> 0);

COMMIT;
