BEGIN;

CREATE TABLE dressed.calibration_profiles (
  calibration_profile_id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 120),
  card_type text NOT NULL CHECK (length(trim(card_type)) BETWEEN 1 AND 120),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE dressed.calibration_patches (
  calibration_profile_id uuid NOT NULL REFERENCES dressed.calibration_profiles(calibration_profile_id) ON DELETE CASCADE,
  patch_index integer NOT NULL CHECK (patch_index >= 0),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  lab_l numeric(7,3) NOT NULL CHECK (lab_l BETWEEN 0 AND 100),
  lab_a numeric(7,3) NOT NULL CHECK (lab_a BETWEEN -160 AND 160),
  lab_b numeric(7,3) NOT NULL CHECK (lab_b BETWEEN -160 AND 160),
  PRIMARY KEY (calibration_profile_id, patch_index),
  UNIQUE (calibration_profile_id, label)
);

CREATE TABLE dressed.garment_images (
  image_id uuid PRIMARY KEY,
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  calibration_profile_id uuid NOT NULL REFERENCES dressed.calibration_profiles(calibration_profile_id),
  role text NOT NULL CHECK (role IN ('whole','detail','additional')),
  original_filename text NOT NULL,
  original_relative_path text NOT NULL UNIQUE CHECK (original_relative_path !~ '(^|[\\/])\.\.([\\/]|$)'),
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg','image/png')),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  card_visibility_confirmed boolean NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('accepted_for_analysis','recapture_required')),
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  captured_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX garment_images_current_role_idx ON dressed.garment_images(garment_id, role) WHERE is_current AND role IN ('whole','detail');
CREATE INDEX garment_images_garment_idx ON dressed.garment_images(garment_id, is_current, role);
CREATE INDEX garment_images_hash_idx ON dressed.garment_images(content_hash);

CREATE TABLE dressed.image_quality_findings (
  image_id uuid NOT NULL REFERENCES dressed.garment_images(image_id) ON DELETE CASCADE,
  finding_index integer NOT NULL CHECK (finding_index >= 0),
  code text NOT NULL CHECK (code ~ '^[a-z0-9_]+$'),
  severity text NOT NULL CHECK (severity IN ('info','warning','error')),
  message text NOT NULL,
  PRIMARY KEY (image_id, finding_index)
);

CREATE TABLE dressed.image_derivatives (
  derivative_id uuid PRIMARY KEY,
  source_image_id uuid NOT NULL REFERENCES dressed.garment_images(image_id),
  derivative_type text NOT NULL CHECK (derivative_type IN ('corrected','thumbnail','mask')),
  relative_path text NOT NULL UNIQUE CHECK (relative_path !~ '(^|[\\/])\.\.([\\/]|$)'),
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL,
  algorithm_version text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (source_image_id, derivative_type, algorithm_version)
);

CREATE INDEX image_derivatives_source_idx ON dressed.image_derivatives(source_image_id, derivative_type);

COMMIT;
