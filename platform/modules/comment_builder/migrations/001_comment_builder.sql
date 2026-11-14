CREATE TABLE IF NOT EXISTS comment_builder_workspaces (
 app_id TEXT NOT NULL, user_id TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(app_id,user_id)
);
CREATE TABLE IF NOT EXISTS comment_builder_receipts (
 app_id TEXT NOT NULL, user_id TEXT NOT NULL, command_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
 PRIMARY KEY(app_id,user_id,command_id)
);
INSERT OR IGNORE INTO app_module_assignments(app_id,module_name)
 SELECT 'principal-ed','comment_builder'
 WHERE EXISTS (SELECT 1 FROM app_module_assignments WHERE app_id='principal-ed');
