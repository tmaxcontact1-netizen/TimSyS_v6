CREATE TABLE IF NOT EXISTS communication_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  default_channel TEXT NOT NULL DEFAULT 'in_app' CHECK(default_channel IN ('in_app','email','sms','push')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(app_id,name)
);

CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  subject_component TEXT,
  subject_type TEXT,
  subject_id TEXT,
  template_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','partially_delivered','delivered','failed','withdrawn')),
  scheduled_at TEXT,
  queued_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(template_id) REFERENCES communication_templates(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_communications_app_status ON communications(app_id,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_communications_subject ON communications(app_id,subject_component,subject_type,subject_id);

CREATE TABLE IF NOT EXISTS communication_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  communication_id INTEGER NOT NULL,
  party_type TEXT NOT NULL CHECK(party_type IN ('user','staff','student','guardian','team','external')),
  party_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('in_app','email','sms','push')),
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','queued','delivered','failed','read','cancelled')),
  provider_key TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(communication_id,party_type,party_id,channel,address),
  FOREIGN KEY(communication_id) REFERENCES communications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_communication_recipients_party ON communication_recipients(party_type,party_id,status);
CREATE INDEX IF NOT EXISTS idx_communication_recipients_outbox ON communication_recipients(channel,status);

CREATE TABLE IF NOT EXISTS communication_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  communication_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(communication_id) REFERENCES communications(id) ON DELETE CASCADE
);
