CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  title TEXT NOT NULL,
  description TEXT,
  subject_component TEXT,
  subject_type TEXT,
  subject_id TEXT,
  responsibility_id INTEGER,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','blocked','completed','withdrawn')),
  starts_at TEXT,
  due_at TEXT,
  completed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(responsibility_id) REFERENCES responsibilities(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_app_status_due ON tasks(app_id,status,due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(app_id,subject_component,subject_type,subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_responsibility ON tasks(responsibility_id);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  prerequisite_task_id INTEGER NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK(dependency_type IN ('blocks','related')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id,prerequisite_task_id,dependency_type),
  CHECK(task_id <> prerequisite_task_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(prerequisite_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_prerequisite ON task_dependencies(prerequisite_task_id);

CREATE TABLE IF NOT EXISTS task_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_transitions_task ON task_transitions(task_id,created_at);
