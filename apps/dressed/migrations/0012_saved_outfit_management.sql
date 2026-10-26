BEGIN;
ALTER TABLE dressed.saved_outfits ADD COLUMN retired_at timestamptz;
COMMIT;
