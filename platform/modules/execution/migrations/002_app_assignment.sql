-- Add the new module once on existing Principal'Ed installations. Do not change
-- later user choices, and leave a fresh install's default seeding to Builder.
INSERT OR IGNORE INTO app_module_assignments(app_id,module_name)
SELECT 'principal-ed','execution'
WHERE EXISTS(SELECT 1 FROM app_module_assignments WHERE app_id='principal-ed');
