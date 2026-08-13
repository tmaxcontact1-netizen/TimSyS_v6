ALTER TABLE inventory_items ADD COLUMN app_id TEXT NOT NULL DEFAULT 'principal-ed';
CREATE INDEX IF NOT EXISTS idx_inventory_app ON inventory_items(app_id);
