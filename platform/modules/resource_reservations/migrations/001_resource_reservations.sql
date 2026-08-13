CREATE TABLE IF NOT EXISTS resource_reservations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', item_id INTEGER NOT NULL,
 subject_component TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, title TEXT NOT NULL,
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), notes TEXT,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','issued','returned','cancelled','withdrawn')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_resource_reservations_window ON resource_reservations(app_id,item_id,starts_at,ends_at,status);
CREATE INDEX IF NOT EXISTS idx_resource_reservations_subject ON resource_reservations(app_id,subject_component,subject_type,subject_id);
