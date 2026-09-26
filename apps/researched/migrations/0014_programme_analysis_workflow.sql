CREATE TABLE IF NOT EXISTS researched.programme_link_candidates(
  id uuid PRIMARY KEY,
  study_id uuid NOT NULL REFERENCES researched.studies(id) ON DELETE CASCADE,
  source_document_id uuid NOT NULL REFERENCES researched.sources(id) ON DELETE CASCADE,
  institution text NOT NULL,
  programme_name text NOT NULL,
  qualification_level text NOT NULL CHECK(qualification_level IN('masters','doctorate','other')),
  original_url text NOT NULL,
  canonical_url text NOT NULL,
  decision text NOT NULL DEFAULT 'included' CHECK(decision IN('included','excluded')),
  decision_reason text,
  ordinal integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(study_id,canonical_url)
);

CREATE TABLE IF NOT EXISTS researched.programme_capture_jobs(
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL UNIQUE REFERENCES researched.programme_link_candidates(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES researched.studies(id) ON DELETE CASCADE,
  source_id uuid REFERENCES researched.sources(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','succeeded','failed')),
  attempts integer NOT NULL DEFAULT 0,
  maximum_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  next_attempt_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS researched.programme_records(
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL UNIQUE REFERENCES researched.programme_link_candidates(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES researched.studies(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES researched.sources(id) ON DELETE CASCADE,
  institution text NOT NULL,
  programme_name text NOT NULL,
  qualification_level text NOT NULL,
  award text,
  delivery_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration text,
  credit_requirement text,
  curriculum jsonb NOT NULL DEFAULT '[]'::jsonb,
  concentrations jsonb NOT NULL DEFAULT '[]'::jsonb,
  admission_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  professional_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(4,3) NOT NULL CHECK(confidence>=0 AND confidence<=1),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL,
  extractor_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS programme_candidates_study_idx ON researched.programme_link_candidates(study_id,ordinal);
CREATE INDEX IF NOT EXISTS programme_jobs_due_idx ON researched.programme_capture_jobs(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS programme_records_study_idx ON researched.programme_records(study_id,institution,programme_name);
