CREATE SCHEMA IF NOT EXISTS researched;
CREATE TABLE IF NOT EXISTS researched.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS researched.studies(
 id uuid PRIMARY KEY, title text NOT NULL, research_question text NOT NULL, description text, methodology text,
 inclusion_rules jsonb NOT NULL DEFAULT '[]', exclusion_rules jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','locked','archived')),
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS researched.entity_types(
 id uuid PRIMARY KEY, study_id uuid NOT NULL REFERENCES researched.studies(id), name text NOT NULL, description text,
 field_schema jsonb NOT NULL DEFAULT '{}', parent_type_id uuid REFERENCES researched.entity_types(id), created_at timestamptz NOT NULL,
 UNIQUE(study_id,name)
);
CREATE TABLE IF NOT EXISTS researched.entities(
 id uuid PRIMARY KEY, study_id uuid NOT NULL REFERENCES researched.studies(id), entity_type_id uuid NOT NULL REFERENCES researched.entity_types(id),
 parent_id uuid REFERENCES researched.entities(id), label text NOT NULL, attributes jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS researched.sources(
 id uuid PRIMARY KEY, study_id uuid NOT NULL REFERENCES researched.studies(id), entity_id uuid REFERENCES researched.entities(id), label text NOT NULL,
 original_url text NOT NULL, source_type text NOT NULL CHECK(source_type IN('webpage','pdf','document','other')),
 authority text NOT NULL DEFAULT 'unknown' CHECK(authority IN('primary','secondary','unknown')),
 corpus_status text NOT NULL DEFAULT 'pending' CHECK(corpus_status IN('pending','included','excluded')),
 completeness text NOT NULL DEFAULT 'unassessed', exclusion_reason text, notes text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 UNIQUE(study_id,original_url)
);
CREATE TABLE IF NOT EXISTS researched.source_snapshots(
 id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES researched.sources(id), sequence integer NOT NULL CHECK(sequence>0),
 retrieved_at timestamptz NOT NULL, content_hash text NOT NULL, media_type text NOT NULL, byte_length integer NOT NULL CHECK(byte_length>=0),
 storage_path text NOT NULL, parser_version text, retrieval_metadata jsonb NOT NULL DEFAULT '{}', immutable boolean NOT NULL DEFAULT true,
 UNIQUE(source_id,sequence), UNIQUE(source_id,content_hash)
);
CREATE TABLE IF NOT EXISTS researched.audit_events(
 id uuid PRIMARY KEY, study_id uuid NOT NULL REFERENCES researched.studies(id), entity_kind text NOT NULL, entity_id uuid NOT NULL,
 action text NOT NULL, actor text NOT NULL, occurred_at timestamptz NOT NULL, before_value jsonb, after_value jsonb, reason text
);
CREATE INDEX IF NOT EXISTS researched_sources_study_idx ON researched.sources(study_id,corpus_status);
CREATE INDEX IF NOT EXISTS researched_entities_study_idx ON researched.entities(study_id,entity_type_id);
