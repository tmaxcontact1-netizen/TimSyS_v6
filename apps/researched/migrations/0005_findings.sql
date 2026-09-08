CREATE TABLE IF NOT EXISTS researched.findings(
 id uuid PRIMARY KEY,
 study_id uuid NOT NULL REFERENCES researched.studies(id),
 title text NOT NULL,
 conclusion text NOT NULL,
 confidence text NOT NULL CHECK(confidence IN('low','medium','high','unassessed')),
 limitations text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','confirmed','withdrawn')),
 authored_by text NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS researched.finding_evidence(
 finding_id uuid NOT NULL REFERENCES researched.findings(id) ON DELETE CASCADE,
 evidence_id uuid NOT NULL REFERENCES researched.evidence_items(id),
 PRIMARY KEY(finding_id,evidence_id)
);
CREATE INDEX IF NOT EXISTS researched_findings_study_idx ON researched.findings(study_id,status,created_at DESC);
