BEGIN;
CREATE TABLE dressed.wardrobe_service_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  owner_id text NOT NULL,
  storage_binding_hash text NOT NULL
);
CREATE TABLE dressed.wardrobe_command_receipts (
  owner_id text NOT NULL,
  command_key text NOT NULL,
  payload_hash text NOT NULL,
  operation text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, command_key)
);
CREATE TABLE dressed.wardrobe_file_cleanup (
  garment_id uuid PRIMARY KEY,
  completed_at timestamptz,
  error_code text
);
COMMIT;
