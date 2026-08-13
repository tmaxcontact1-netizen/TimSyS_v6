CREATE TABLE IF NOT EXISTS responsibilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  subject_component TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  party_type TEXT NOT NULL CHECK(party_type IN ('staff','user','team','external')),
  party_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('proposed','active','delegated','handed_over','completed','withdrawn')),
  starts_at TEXT,
  ends_at TEXT,
  escalation_party_type TEXT,
  escalation_party_id TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_responsibility_active_role ON responsibilities(app_id,subject_component,subject_type,subject_id,role) WHERE status IN ('proposed','active','delegated');
CREATE INDEX IF NOT EXISTS idx_responsibility_subject ON responsibilities(app_id,subject_component,subject_type,subject_id);
CREATE INDEX IF NOT EXISTS idx_responsibility_party ON responsibilities(app_id,party_type,party_id,status);

CREATE TABLE IF NOT EXISTS responsibility_contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  responsibility_id INTEGER NOT NULL,
  party_type TEXT NOT NULL CHECK(party_type IN ('staff','user','team','external')),
  party_id TEXT NOT NULL,
  contribution_role TEXT NOT NULL DEFAULT 'contributor',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','withdrawn')),
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(responsibility_id,party_type,party_id,contribution_role),
  FOREIGN KEY(responsibility_id) REFERENCES responsibilities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS responsibility_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  responsibility_id INTEGER NOT NULL,
  transition_type TEXT NOT NULL CHECK(transition_type IN ('delegation','handover','escalation','status_change')),
  from_party_type TEXT,
  from_party_id TEXT,
  to_party_type TEXT,
  to_party_id TEXT,
  reason TEXT,
  effective_at TEXT NOT NULL,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending','accepted','declined','completed','cancelled')),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(responsibility_id) REFERENCES responsibilities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_responsibility_transition ON responsibility_transitions(responsibility_id,created_at);
