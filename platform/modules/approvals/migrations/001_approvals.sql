CREATE TABLE IF NOT EXISTS approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  title TEXT NOT NULL,
  description TEXT,
  subject_component TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','rejected','withdrawn')),
  requested_by TEXT NOT NULL,
  submitted_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_approval_requests_app_status ON approval_requests(app_id,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_subject ON approval_requests(app_id,subject_component,subject_type,subject_id);

CREATE TABLE IF NOT EXISTS approval_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  name TEXT NOT NULL,
  approver_type TEXT NOT NULL CHECK(approver_type IN ('user','staff','team','role')),
  approver_id TEXT NOT NULL,
  required_decisions INTEGER NOT NULL DEFAULT 1 CHECK(required_decisions > 0),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','pending','approved','rejected','skipped')),
  activated_at TEXT,
  resolved_at TEXT,
  UNIQUE(request_id,sequence),
  FOREIGN KEY(request_id) REFERENCES approval_requests(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_approval_stages_request ON approval_stages(request_id,sequence);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('approved','rejected')),
  comments TEXT,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stage_id,decided_by),
  FOREIGN KEY(stage_id) REFERENCES approval_stages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_approval_decisions_stage ON approval_decisions(stage_id,decided_at);

CREATE TABLE IF NOT EXISTS approval_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(request_id) REFERENCES approval_requests(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_approval_transitions_request ON approval_transitions(request_id,created_at);
