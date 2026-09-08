CREATE TABLE IF NOT EXISTS researched.research_codes(
 id uuid PRIMARY KEY,
 study_id uuid NOT NULL REFERENCES researched.studies(id),
 label text NOT NULL,
 description text,
 colour text NOT NULL DEFAULT '#59b8a8',
 created_at timestamptz NOT NULL,
 UNIQUE(study_id,label)
);
CREATE TABLE IF NOT EXISTS researched.evidence_items(
 id uuid PRIMARY KEY,
 study_id uuid NOT NULL REFERENCES researched.studies(id),
 source_id uuid NOT NULL REFERENCES researched.sources(id),
 snapshot_id uuid NOT NULL REFERENCES researched.source_snapshots(id),
 segment_id uuid NOT NULL REFERENCES researched.extracted_segments(id),
 evidence_type text NOT NULL CHECK(evidence_type IN('claim','fact','observation','definition','requirement','method','counterevidence','other')),
 captured_text text NOT NULL,
 interpretation text NOT NULL,
 confidence text NOT NULL CHECK(confidence IN('low','medium','high','unassessed')),
 notes text,
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','superseded','withdrawn')),
 captured_by text NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS researched.evidence_item_codes(
 evidence_id uuid NOT NULL REFERENCES researched.evidence_items(id) ON DELETE CASCADE,
 code_id uuid NOT NULL REFERENCES researched.research_codes(id),
 PRIMARY KEY(evidence_id,code_id)
);
CREATE INDEX IF NOT EXISTS researched_evidence_study_idx ON researched.evidence_items(study_id,created_at DESC);
CREATE INDEX IF NOT EXISTS researched_evidence_source_idx ON researched.evidence_items(source_id,snapshot_id);
