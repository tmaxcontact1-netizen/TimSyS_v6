ALTER TABLE calendar_settings ADD COLUMN calendar_start TEXT NOT NULL DEFAULT '01-01';
ALTER TABLE calendar_settings ADD COLUMN calendar_end TEXT NOT NULL DEFAULT '12-31';
ALTER TABLE calendar_settings ADD COLUMN academic_start TEXT NOT NULL DEFAULT '08-01';
ALTER TABLE calendar_settings ADD COLUMN academic_end TEXT NOT NULL DEFAULT '07-31';

CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  original_start_at TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('cancelled','rescheduled')),
  replacement_start_at TEXT,
  replacement_end_at TEXT,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entry_id, original_start_at),
  FOREIGN KEY(entry_id) REFERENCES calendar_entries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_entry ON calendar_exceptions(entry_id, original_start_at);

