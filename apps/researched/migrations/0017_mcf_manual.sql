-- Manual MCF research. Existing sources and prototype results are untouched.
CREATE TABLE researched.mcf_instruments (
 version text PRIMARY KEY, hash text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_datasets (
 id uuid PRIMARY KEY REFERENCES researched.studies(id), mode text NOT NULL CHECK(mode IN ('reviews','documentary')),
 review_category text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_imports (
 id uuid PRIMARY KEY, dataset_id uuid NOT NULL REFERENCES researched.mcf_datasets(id),
 snapshot_id uuid NOT NULL REFERENCES researched.source_snapshots(id), filename text NOT NULL,
 extracted jsonb NOT NULL, extraction_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_import_mappings (
 id uuid PRIMARY KEY, import_id uuid NOT NULL UNIQUE REFERENCES researched.mcf_imports(id),
 configuration jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_records (
 id uuid PRIMARY KEY, dataset_id uuid NOT NULL REFERENCES researched.mcf_datasets(id),
 import_id uuid NOT NULL REFERENCES researched.mcf_imports(id), mapping_id uuid NOT NULL REFERENCES researched.mcf_import_mappings(id),
 review_identifier text NOT NULL, institution text NOT NULL, review_category text NOT NULL,
 source_type text NOT NULL, original_text text NOT NULL, working_text text NOT NULL,
 locator jsonb NOT NULL, preprocessing jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_unit_sets (
 id uuid PRIMARY KEY, record_id uuid NOT NULL REFERENCES researched.mcf_records(id),
 parent_id uuid REFERENCES researched.mcf_unit_sets(id), version integer NOT NULL,
 reason text NOT NULL, actor text NOT NULL, segmenter_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(record_id,version)
);
CREATE TABLE researched.mcf_units (
 id uuid PRIMARY KEY, unit_set_id uuid NOT NULL REFERENCES researched.mcf_unit_sets(id), ordinal integer NOT NULL,
 start_offset integer NOT NULL, end_offset integer NOT NULL, original_text text NOT NULL,
 CHECK(start_offset>=0 AND end_offset>start_offset), UNIQUE(unit_set_id,ordinal)
);
CREATE TABLE researched.mcf_sessions (
 id uuid PRIMARY KEY, dataset_id uuid NOT NULL REFERENCES researched.mcf_datasets(id), title text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('coding','validation')), blind boolean NOT NULL,
 instrument_version text NOT NULL REFERENCES researched.mcf_instruments(version), instrument_hash text NOT NULL,
 engine_version text NOT NULL, software_version text NOT NULL, configuration jsonb NOT NULL,
 actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_session_units (
 session_id uuid NOT NULL REFERENCES researched.mcf_sessions(id), unit_id uuid NOT NULL REFERENCES researched.mcf_units(id),
 ordinal integer NOT NULL, PRIMARY KEY(session_id,unit_id), UNIQUE(session_id,ordinal)
);
CREATE TABLE researched.mcf_decisions (
 id uuid PRIMARY KEY, session_id uuid NOT NULL, unit_id uuid NOT NULL,
 previous_id uuid REFERENCES researched.mcf_decisions(id), revision integer NOT NULL, codes jsonb NOT NULL,
 valence text CHECK(valence IN ('positive','negative','neutral-descriptive','mixed-ambiguous')),
 reviewed_no_code boolean NOT NULL, notes text NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,unit_id) REFERENCES researched.mcf_session_units(session_id,unit_id),
 CHECK(jsonb_typeof(codes)='array'), CHECK(reviewed_no_code=(jsonb_array_length(codes)=0)), UNIQUE(session_id,unit_id,revision)
);
CREATE INDEX mcf_decision_history ON researched.mcf_decisions(session_id,unit_id,created_at,id);
CREATE TABLE researched.mcf_representation_decisions (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES researched.mcf_sessions(id), record_id uuid NOT NULL REFERENCES researched.mcf_records(id),
 competency_id text NOT NULL, previous_id uuid REFERENCES researched.mcf_representation_decisions(id), revision integer NOT NULL,
 state text NOT NULL CHECK(state IN ('assessed','not-yet-assessed','source-unavailable')), score integer,
 evidence_unit_ids jsonb NOT NULL, notes text NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((state='assessed' AND score IS NOT NULL AND score BETWEEN 0 AND 3) OR (state<>'assessed' AND score IS NULL)),
 CHECK(score IS NULL OR score=0 OR jsonb_array_length(evidence_unit_ids)>0), UNIQUE(session_id,record_id,competency_id,revision)
);
-- History is enforced in storage as well as in the API. Corrections append new rows.
CREATE FUNCTION researched.mcf_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'mcf_append_only'; END; $$;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['mcf_instruments','mcf_datasets','mcf_imports','mcf_import_mappings','mcf_records','mcf_unit_sets','mcf_units','mcf_sessions','mcf_session_units','mcf_decisions','mcf_representation_decisions'] LOOP
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON researched.%I FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable()',name);
 END LOOP;
END $$;
