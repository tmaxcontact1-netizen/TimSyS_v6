CREATE TABLE IF NOT EXISTS cover_assignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, cover_demand_id INTEGER NOT NULL,
 recommendation_run_id INTEGER, recommendation_id INTEGER, candidate_type TEXT NOT NULL,
 candidate_ref TEXT NOT NULL, candidate_name TEXT NOT NULL, decision_type TEXT NOT NULL CHECK(decision_type IN ('recommended','override')),
 decision_reason TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reassigned','cancelled','completed')),
 revision INTEGER NOT NULL DEFAULT 1, assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL DEFAULT(datetime('now')),
 ended_by TEXT, ended_at TEXT, end_reason TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(cover_demand_id) REFERENCES cover_demands(id), FOREIGN KEY(recommendation_run_id) REFERENCES cover_recommendation_runs(id),
 FOREIGN KEY(recommendation_id) REFERENCES cover_recommendations(id)
);
CREATE TABLE IF NOT EXISTS cover_decision_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, cover_demand_id INTEGER NOT NULL,
 assignment_id INTEGER, recommendation_id INTEGER, action TEXT NOT NULL CHECK(action IN ('confirmed','overridden','rejected','reassigned','cancelled','completed')),
 reason TEXT, snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(cover_demand_id) REFERENCES cover_demands(id), FOREIGN KEY(assignment_id) REFERENCES cover_assignments(id),
 FOREIGN KEY(recommendation_id) REFERENCES cover_recommendations(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cover_one_active_assignment ON cover_assignments(app_id,cover_demand_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_cover_assignment_candidate ON cover_assignments(app_id,candidate_type,candidate_ref,status,assigned_at);
CREATE INDEX IF NOT EXISTS idx_cover_decision_demand ON cover_decision_audit(app_id,cover_demand_id,created_at DESC,id DESC);
