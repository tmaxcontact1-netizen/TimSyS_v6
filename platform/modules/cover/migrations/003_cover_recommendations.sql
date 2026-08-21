CREATE TABLE IF NOT EXISTS cover_recommendation_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, cover_demand_id INTEGER NOT NULL,
 external_key TEXT NOT NULL, policy_id INTEGER, policy_revision INTEGER NOT NULL DEFAULT 0,
 emergency INTEGER NOT NULL DEFAULT 0 CHECK(emergency IN (0,1)), candidate_count INTEGER NOT NULL DEFAULT 0,
 eligible_count INTEGER NOT NULL DEFAULT 0, input_snapshot_json TEXT NOT NULL, input_snapshot_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','superseded')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,external_key), FOREIGN KEY(cover_demand_id) REFERENCES cover_demands(id), FOREIGN KEY(policy_id) REFERENCES cover_policies(id)
);
CREATE TABLE IF NOT EXISTS cover_recommendations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, recommendation_run_id INTEGER NOT NULL, cover_demand_id INTEGER NOT NULL,
 candidate_type TEXT NOT NULL CHECK(candidate_type IN ('teacher','staff','external_manual')), candidate_ref TEXT NOT NULL,
 candidate_name TEXT NOT NULL, rank INTEGER, eligible INTEGER NOT NULL CHECK(eligible IN (0,1)), score REAL NOT NULL,
 evidence_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recommended' CHECK(status IN ('recommended','excluded','superseded')),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,recommendation_run_id,candidate_type,candidate_ref), FOREIGN KEY(recommendation_run_id) REFERENCES cover_recommendation_runs(id),
 FOREIGN KEY(cover_demand_id) REFERENCES cover_demands(id)
);
CREATE INDEX IF NOT EXISTS idx_cover_runs_demand ON cover_recommendation_runs(app_id,cover_demand_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cover_recommendations_rank ON cover_recommendations(app_id,recommendation_run_id,eligible DESC,rank,score DESC);
