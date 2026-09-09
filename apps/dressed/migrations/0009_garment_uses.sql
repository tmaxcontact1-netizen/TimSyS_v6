BEGIN;

CREATE TABLE dressed.garment_use_types (
  use_id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 80),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE dressed.garment_uses (
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id) ON DELETE CASCADE,
  use_id uuid NOT NULL REFERENCES dressed.garment_use_types(use_id),
  PRIMARY KEY (garment_id, use_id)
);

CREATE INDEX garment_uses_use_idx ON dressed.garment_uses(use_id, garment_id);

ALTER TABLE dressed.saved_outfits
  ADD COLUMN use_id uuid REFERENCES dressed.garment_use_types(use_id);

CREATE INDEX saved_outfits_use_idx ON dressed.saved_outfits(use_id, created_at DESC);

INSERT INTO dressed.garment_use_types(use_id,slug,name,sort_order,created_at,updated_at) VALUES
('30000000-0000-4000-8000-000000000001','work','Work',10,now(),now()),
('30000000-0000-4000-8000-000000000002','sport','Sport',20,now(),now()),
('30000000-0000-4000-8000-000000000003','home','Home',30,now(),now()),
('30000000-0000-4000-8000-000000000004','social','Social',40,now(),now()),
('30000000-0000-4000-8000-000000000005','travel','Travel',50,now(),now()),
('30000000-0000-4000-8000-000000000006','formal-events','Formal events',60,now(),now());

COMMIT;
