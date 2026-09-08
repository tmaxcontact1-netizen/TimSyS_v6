ALTER TABLE researched.extracted_segments ADD COLUMN IF NOT EXISTS locator jsonb NOT NULL DEFAULT '{}';
