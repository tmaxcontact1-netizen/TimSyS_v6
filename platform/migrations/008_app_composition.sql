CREATE TABLE IF NOT EXISTS app_module_assignments (
  app_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  PRIMARY KEY (app_id, module_name)
);

CREATE TABLE IF NOT EXISTS app_component_assignments (
  app_id TEXT NOT NULL,
  component_name TEXT NOT NULL,
  assigned_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  PRIMARY KEY (app_id, component_name)
);
