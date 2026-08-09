CREATE TABLE IF NOT EXISTS app_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_app_modules_app_id ON app_modules(app_id);
CREATE INDEX IF NOT EXISTS idx_app_modules_module_name ON app_modules(module_name);
