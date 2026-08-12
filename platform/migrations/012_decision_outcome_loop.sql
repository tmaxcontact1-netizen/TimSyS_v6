CREATE TABLE IF NOT EXISTS action_items (
    id TEXT PRIMARY KEY,
    insight_id TEXT,
    decision_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','cancelled')),
    due_at INTEGER,
    review_at INTEGER,
    completed_at INTEGER,
    completion_note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(insight_id) REFERENCES insight_products(id),
    FOREIGN KEY(decision_id) REFERENCES decision_log(id)
);
CREATE INDEX IF NOT EXISTS idx_action_owner_status ON action_items(owner_id,status,due_at);
CREATE INDEX IF NOT EXISTS idx_action_insight ON action_items(insight_id);

ALTER TABLE outcome_records ADD COLUMN assessment TEXT;
ALTER TABLE outcome_records ADD COLUMN assessment_explanation TEXT;
ALTER TABLE outcome_records ADD COLUMN baseline_metric_point_id INTEGER;
ALTER TABLE outcome_records ADD COLUMN followup_metric_point_id INTEGER;
ALTER TABLE outcome_records ADD COLUMN action_id TEXT;

CREATE TABLE IF NOT EXISTS reminder_dispatches (
    id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    reminder_kind TEXT NOT NULL CHECK(reminder_kind IN ('approaching','overdue','review_due')),
    insight_id TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    UNIQUE(action_id,reminder_kind),
    FOREIGN KEY(action_id) REFERENCES action_items(id),
    FOREIGN KEY(insight_id) REFERENCES insight_products(id)
);

