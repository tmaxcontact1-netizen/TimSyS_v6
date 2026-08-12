-- Align the room API's human-readable building field with the durable schema.
-- building_id is retained for future canonical building relationships.
ALTER TABLE rooms ADD COLUMN building TEXT;
CREATE INDEX IF NOT EXISTS idx_rooms_building_text ON rooms(building);
