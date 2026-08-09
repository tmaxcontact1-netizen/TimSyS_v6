CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  icon_url TEXT,
  entry_point TEXT NOT NULL,
  capabilities TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apps_active ON apps(active);
CREATE INDEX idx_apps_app_id ON apps(app_id);

INSERT INTO apps (app_id, display_name, version, description, entry_point, capabilities, active) VALUES
  ('principaled', 'Principal''Ed', '1.0.0', 'School administration desktop app', '/principaled', '{"features":["registrar","crud","csv_import"],"roles":["admin"]}', 1),
  ('competeed', 'Compete''Ed', '1.0.0', 'Sports team administration app', '/competeed', '{"features":["portal","assignments","grades"],"roles":["student"]}', 1),
  ('sanctifyed', 'Sanctify''Ed', '1.0.0', 'Church administration app', '/sanctifyed', '{"features":["portal","grading","attendance"],"roles":["teacher"]}', 1),
  ('memecoined', 'meMeCoiN''Ed', '1.0.0', 'Meme coin trading app', '/memecoined', '{"features":["trading","portfolio","alerts"]}', 1);
