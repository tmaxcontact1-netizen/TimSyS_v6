-- One-time enrolment for an existing Principal’Ed installation. Empty installs
-- are populated by Builder's complete default list; do not short-circuit it.
INSERT OR IGNORE INTO app_module_assignments(app_id,module_name)
SELECT 'principal-ed','observation_studio'
WHERE EXISTS (SELECT 1 FROM app_module_assignments WHERE app_id='principal-ed');
