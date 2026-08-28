BEGIN;

INSERT INTO dressed.garment_categories(category_id,parent_category_id,name,slug,sort_order,created_at,updated_at)
VALUES('00000000-0000-4000-8000-000000000000',NULL,'Uncategorised','uncategorised',0,now(),now());

CREATE TABLE dressed.visual_fingerprints (
  fingerprint_id uuid PRIMARY KEY,
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  schema_version text NOT NULL,
  algorithm_version text NOT NULL,
  whole_image_id uuid REFERENCES dressed.garment_images(image_id),
  detail_image_id uuid REFERENCES dressed.garment_images(image_id),
  measurement_payload jsonb NOT NULL,
  confidence numeric(6,5) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX visual_fingerprints_current_idx ON dressed.visual_fingerprints(garment_id) WHERE is_current;
CREATE INDEX visual_fingerprints_garment_idx ON dressed.visual_fingerprints(garment_id,created_at DESC);

CREATE TABLE dressed.garment_field_suggestions (
  suggestion_id uuid PRIMARY KEY,
  fingerprint_id uuid NOT NULL REFERENCES dressed.visual_fingerprints(fingerprint_id),
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  field_name text NOT NULL CHECK (field_name IN ('category','formality','seasons','colour_summary','pattern_summary')),
  suggested_value jsonb NOT NULL,
  confidence numeric(6,5) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','superseded')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL,
  UNIQUE (fingerprint_id,field_name)
);

CREATE INDEX garment_field_suggestions_pending_idx ON dressed.garment_field_suggestions(garment_id,status,created_at DESC);

COMMIT;
