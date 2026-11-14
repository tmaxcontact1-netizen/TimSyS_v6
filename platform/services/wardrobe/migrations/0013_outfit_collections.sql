BEGIN;
CREATE TABLE dressed.outfit_collections (
 collection_id uuid PRIMARY KEY,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE TABLE dressed.outfit_collection_items (
 collection_id uuid NOT NULL REFERENCES dressed.outfit_collections(collection_id) ON DELETE CASCADE,
 outfit_id uuid NOT NULL REFERENCES dressed.saved_outfits(outfit_id) ON DELETE CASCADE,
 PRIMARY KEY(collection_id,outfit_id)
);
CREATE INDEX outfit_collection_items_outfit_idx ON dressed.outfit_collection_items(outfit_id);
COMMIT;
