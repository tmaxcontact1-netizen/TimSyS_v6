CREATE TABLE IF NOT EXISTS calendar_settings (
  app_id TEXT PRIMARY KEY,
  calendar_system TEXT NOT NULL DEFAULT 'gregorian',
  locale TEXT NOT NULL DEFAULT 'en-GB',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  academic_start_month INTEGER NOT NULL DEFAULT 8 CHECK(academic_start_month BETWEEN 1 AND 12),
  academic_start_day INTEGER NOT NULL DEFAULT 1 CHECK(academic_start_day BETWEEN 1 AND 31),
  academic_year_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calendar_layers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT,
  colour TEXT NOT NULL DEFAULT '#64748b',
  sensitive INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(app_id, code)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  title TEXT NOT NULL,
  description TEXT,
  primary_layer TEXT NOT NULL,
  layer_codes TEXT NOT NULL DEFAULT '[]',
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('draft','planned','confirmed','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
  owner_id TEXT,
  collaborator_ids TEXT NOT NULL DEFAULT '[]',
  visibility_roles TEXT NOT NULL DEFAULT '["superuser","principal"]',
  recurrence TEXT,
  rollover_strategy TEXT NOT NULL DEFAULT 'manual_review',
  parent_event_id INTEGER,
  room_id INTEGER,
  inventory_ids TEXT NOT NULL DEFAULT '[]',
  checklist TEXT NOT NULL DEFAULT '[]',
  dependencies TEXT NOT NULL DEFAULT '[]',
  reminders TEXT NOT NULL DEFAULT '[]',
  public_enabled INTEGER NOT NULL DEFAULT 0,
  public_title TEXT,
  public_description TEXT,
  public_start_at TEXT,
  public_end_at TEXT,
  public_status TEXT NOT NULL DEFAULT 'draft' CHECK(public_status IN ('draft','published','withdrawn')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(parent_event_id) REFERENCES calendar_events(id) ON DELETE SET NULL,
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS calendar_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  UNIQUE(event_id, start_at),
  FOREIGN KEY(event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_scope_dates ON calendar_events(app_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_instances_dates ON calendar_instances(start_at, end_at);
