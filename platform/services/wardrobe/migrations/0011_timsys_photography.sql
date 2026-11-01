BEGIN;
CREATE TABLE dressed.photography_uploads (
 upload_id uuid PRIMARY KEY,
 image_id uuid NOT NULL UNIQUE,
 owner_id text NOT NULL,
 metadata jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('open','committed','aborted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photography_uploads_owner ON dressed.photography_uploads(owner_id,status);
COMMIT;
