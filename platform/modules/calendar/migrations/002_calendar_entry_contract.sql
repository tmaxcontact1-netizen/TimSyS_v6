PRAGMA foreign_keys = OFF;

CREATE TABLE calendar_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed', title TEXT NOT NULL, description TEXT,
  primary_layer TEXT NOT NULL, layer_codes TEXT NOT NULL DEFAULT '[]', start_at TEXT NOT NULL, end_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('draft','planned','confirmed','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
  visibility_roles TEXT NOT NULL DEFAULT '["superuser","principal"]', recurrence TEXT,
  rollover_strategy TEXT NOT NULL DEFAULT 'manual_review', parent_entry_id INTEGER,
  source_component TEXT, source_record_id TEXT, source_type TEXT,
  public_enabled INTEGER NOT NULL DEFAULT 0, public_title TEXT, public_description TEXT, public_start_at TEXT, public_end_at TEXT,
  public_status TEXT NOT NULL DEFAULT 'draft' CHECK(public_status IN ('draft','published','withdrawn')),
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(parent_entry_id) REFERENCES calendar_entries(id) ON DELETE SET NULL
);

INSERT INTO calendar_entries (id,app_id,title,description,primary_layer,layer_codes,start_at,end_at,all_day,status,priority,visibility_roles,recurrence,rollover_strategy,parent_entry_id,public_enabled,public_title,public_description,public_start_at,public_end_at,public_status,created_by,created_at,updated_at)
SELECT id,app_id,title,description,primary_layer,layer_codes,start_at,end_at,all_day,status,priority,visibility_roles,recurrence,rollover_strategy,parent_event_id,public_enabled,public_title,public_description,public_start_at,public_end_at,public_status,created_by,created_at,updated_at FROM calendar_events;

CREATE TABLE calendar_instances_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', UNIQUE(entry_id,start_at),
  FOREIGN KEY(entry_id) REFERENCES calendar_entries(id) ON DELETE CASCADE
);
INSERT INTO calendar_instances_new (id,entry_id,start_at,end_at,status) SELECT id,event_id,start_at,end_at,status FROM calendar_instances;
DROP TABLE calendar_instances;
DROP TABLE calendar_events;
ALTER TABLE calendar_instances_new RENAME TO calendar_instances;
CREATE INDEX idx_calendar_entries_scope_dates ON calendar_entries(app_id,start_at,end_at);
CREATE INDEX idx_calendar_entries_source ON calendar_entries(source_component,source_record_id);
CREATE INDEX idx_calendar_instances_dates ON calendar_instances(start_at,end_at);

PRAGMA foreign_keys = ON;
