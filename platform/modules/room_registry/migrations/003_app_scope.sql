ALTER TABLE rooms ADD COLUMN app_id TEXT NOT NULL DEFAULT 'principal-ed';
CREATE INDEX IF NOT EXISTS idx_rooms_app ON rooms(app_id);
