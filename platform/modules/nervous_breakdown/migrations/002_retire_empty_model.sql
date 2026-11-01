-- Retirement after the authorised, verified empty-store audit.
-- Fail closed if a different installation still has unreviewed records.
-- 001 is historical migration input only; no model tables survive this migration.
CREATE TEMP TABLE nb_retirement_guard (remaining INTEGER CHECK (remaining = 0));
INSERT INTO nb_retirement_guard SELECT COUNT(*) FROM nb_records;
INSERT INTO nb_retirement_guard SELECT COUNT(*) FROM nb_revisions;
DROP TABLE nb_retirement_guard;
DROP VIEW IF EXISTS nb_governed_records;
DROP TABLE nb_revisions;
DROP TABLE nb_records;
-- Remove only registrations/telemetry owned by the abandoned model.
DELETE FROM schema_registry WHERE owner_module='nervous_breakdown';
DELETE FROM function_registry WHERE module_name='nervous_breakdown' OR name='execution_context';
DELETE FROM capability_registry WHERE module_name='nervous_breakdown';
DELETE FROM route_registry WHERE module_name='nervous_breakdown' OR handler='execution_context';
DELETE FROM app_component_assignments WHERE component_name='nervous_breakdown';
DELETE FROM component_registry WHERE owner_module='nervous_breakdown';
DELETE FROM module_registry WHERE name='nervous_breakdown';
UPDATE module_registry SET metadata=json_set(metadata,
  '$.dependencies',json((SELECT json_group_array(value) FROM json_each(metadata,'$.dependencies') WHERE value!='nervous_breakdown')),
  '$.routes',json((SELECT json_group_array(json(value)) FROM json_each(metadata,'$.routes') WHERE json_extract(value,'$.handler')!='execution_context')),
  '$.functions',json((SELECT json_group_array(json(value)) FROM json_each(metadata,'$.functions') WHERE json_extract(value,'$.name')!='execution_context')))
WHERE name='execution' AND json_valid(metadata);
DELETE FROM metrics WHERE instr(tags,'module=nervous_breakdown')>0 OR instr(tags,'path=/nervous-breakdown/')>0;
DELETE FROM metric_points WHERE metric_id='component.nervous_breakdown.records';
DELETE FROM metric_definitions WHERE id='component.nervous_breakdown.records';
UPDATE provider_runs SET output_summary=json_remove(output_summary,'$.components.nervous_breakdown')
WHERE json_valid(output_summary) AND json_type(output_summary,'$.components.nervous_breakdown') IS NOT NULL;
