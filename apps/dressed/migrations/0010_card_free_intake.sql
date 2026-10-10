BEGIN;
ALTER TABLE dressed.garment_images ALTER COLUMN calibration_profile_id DROP NOT NULL;
CREATE TABLE dressed.garment_analyses (
  analysis_id uuid PRIMARY KEY,
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id) ON DELETE CASCADE,
  source_image_ids uuid[] NOT NULL,
  crops jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TABLE dressed.garment_appearance_reviews (
  review_id uuid PRIMARY KEY,
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES dressed.garment_analyses(analysis_id),
  fingerprint_id uuid NOT NULL REFERENCES dressed.visual_fingerprints(fingerprint_id),
  values jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX garment_analyses_history ON dressed.garment_analyses(garment_id,created_at DESC);
CREATE INDEX garment_appearance_reviews_history ON dressed.garment_appearance_reviews(garment_id,created_at DESC);
COMMIT;
