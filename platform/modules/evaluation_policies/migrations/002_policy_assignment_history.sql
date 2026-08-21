CREATE TABLE evaluation_policy_assignments_next (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL DEFAULT 'principal-ed',
 policy_id INTEGER NOT NULL,
 scope_type TEXT NOT NULL CHECK(scope_type IN ('school','programme','course','gradebook')),
 scope_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 assigned_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(policy_id) REFERENCES evaluation_policies(id)
);

INSERT INTO evaluation_policy_assignments_next
 (id,app_id,policy_id,scope_type,scope_id,status,assigned_at)
SELECT id,app_id,policy_id,scope_type,scope_id,status,assigned_at
FROM evaluation_policy_assignments;

DROP TABLE evaluation_policy_assignments;
ALTER TABLE evaluation_policy_assignments_next RENAME TO evaluation_policy_assignments;

CREATE UNIQUE INDEX uq_active_policy_assignment
 ON evaluation_policy_assignments(app_id,scope_type,scope_id)
 WHERE status='active';
CREATE INDEX idx_policy_resolution
 ON evaluation_policy_assignments(app_id,scope_type,scope_id,status);
