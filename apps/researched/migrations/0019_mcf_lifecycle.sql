-- Organisational state is separate from immutable research records.
CREATE TABLE researched.mcf_lifecycle_events (
 id uuid PRIMARY KEY, kind text NOT NULL, target_id uuid NOT NULL, dataset_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('rename','archive','restore','delete')),
 label text, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX mcf_lifecycle_target ON researched.mcf_lifecycle_events(kind,target_id,created_at DESC);
CREATE TABLE researched.mcf_file_cleanup (path text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION researched.mcf_archived(k text,t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT action='archive' FROM researched.mcf_lifecycle_events WHERE kind=k AND target_id=t AND action IN ('archive','restore') ORDER BY created_at DESC,id DESC LIMIT 1),false)
$$;
CREATE FUNCTION researched.mcf_label(k text,t uuid,fallback text) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT COALESCE((SELECT label FROM researched.mcf_lifecycle_events WHERE kind=k AND target_id=t AND action='rename' ORDER BY created_at DESC,id DESC LIMIT 1),fallback)
$$;
CREATE FUNCTION researched.mcf_set_referenced(t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM researched.mcf_sessions s, jsonb_array_elements(s.configuration->'unitSets') v WHERE v->>'id'=t::text)
$$;
-- DELETE is available only through the lifecycle transaction. Updates and saved
-- decisions remain immutable, including during permitted unused-data deletion.
CREATE OR REPLACE FUNCTION researched.mcf_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_setting('researched.mcf_unused_delete',true)='yes'
 AND TG_TABLE_NAME IN ('mcf_datasets','mcf_imports','mcf_import_mappings','mcf_records','mcf_unit_sets','mcf_units','mcf_sessions','mcf_session_units','mcf_lifecycle_events') THEN
  IF TG_TABLE_NAME='mcf_unit_sets' THEN
   IF researched.mcf_set_referenced(OLD.id) THEN RAISE EXCEPTION 'protected_research_history'; END IF;
  END IF;
  IF TG_TABLE_NAME='mcf_units' THEN
   IF researched.mcf_set_referenced(OLD.unit_set_id) THEN RAISE EXCEPTION 'protected_research_history'; END IF;
  END IF;
  RETURN OLD;
 END IF;
 RAISE EXCEPTION 'mcf_append_only';
END $$;

CREATE TRIGGER mcf_lifecycle_immutable BEFORE UPDATE OR DELETE ON researched.mcf_lifecycle_events FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
