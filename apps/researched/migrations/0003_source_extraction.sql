CREATE TABLE IF NOT EXISTS researched.source_extractions(
 id uuid PRIMARY KEY,
 snapshot_id uuid NOT NULL UNIQUE REFERENCES researched.source_snapshots(id),
 status text NOT NULL CHECK(status IN('completed','empty','unsupported','failed')),
 extractor_version text NOT NULL,
 extracted_at timestamptz NOT NULL,
 text_content text NOT NULL DEFAULT '',
 character_count integer NOT NULL DEFAULT 0 CHECK(character_count>=0),
 warnings jsonb NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS researched.extracted_segments(
 id uuid PRIMARY KEY,
 extraction_id uuid NOT NULL REFERENCES researched.source_extractions(id) ON DELETE CASCADE,
 ordinal integer NOT NULL CHECK(ordinal>0),
 segment_kind text NOT NULL,
 content text NOT NULL,
 content_hash text NOT NULL,
 UNIQUE(extraction_id,ordinal)
);
CREATE INDEX IF NOT EXISTS researched_extraction_snapshot_idx ON researched.source_extractions(snapshot_id);
CREATE INDEX IF NOT EXISTS researched_segment_extraction_idx ON researched.extracted_segments(extraction_id,ordinal);
