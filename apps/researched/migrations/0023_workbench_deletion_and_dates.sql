-- Explicit whole-work deletion is distinct from editing immutable history.
CREATE OR REPLACE FUNCTION researched.mcf_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_setting('researched.workbench_delete',true)='yes' AND TG_TABLE_NAME <> 'mcf_instruments' THEN RETURN OLD; END IF;
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


CREATE VIEW researched.workbench_times AS
SELECT p.*, cr.created_at AS processing_started_at, cr.completed_at AS processing_finished_at,
 cr.status AS processing_status, ms.created_at AS draft_created_at,
 p.state->>'confirmedAt' AS confirmed_at
FROM researched.workbench_projects p
LEFT JOIN LATERAL (
 SELECT created_at,completed_at,status FROM researched.content_runs WHERE id::text=p.state->>'runId' AND p.tool='content'
 UNION ALL
 SELECT created_at,finished_at,status FROM researched.mcf_ai_runs WHERE session_id::text=p.state->>'sessionId' AND kind='classification' AND p.tool='mcf'
 ORDER BY created_at DESC LIMIT 1
) cr ON true
LEFT JOIN researched.mcf_sessions ms ON ms.id::text=p.state->>'sessionId' AND p.tool='mcf';
