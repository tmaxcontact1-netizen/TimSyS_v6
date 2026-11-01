CREATE TABLE IF NOT EXISTS nb_records (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'principal-ed',
  kind TEXT NOT NULL CHECK(kind IN ('role','source','statement','term','responsibility','connection','role_assignment')),
  revision INTEGER NOT NULL CHECK(revision > 0),
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nb_records_kind ON nb_records(app_id,kind,id);
CREATE VIEW IF NOT EXISTS nb_governed_records AS
SELECT id,app_id,kind,revision,json_extract(data_json,'$.status') AS status
FROM nb_records WHERE json_extract(data_json,'$.is_fixture')=0;
CREATE TABLE IF NOT EXISTS nb_revisions (
  record_id TEXT NOT NULL REFERENCES nb_records(id),
  revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  PRIMARY KEY(record_id,revision)
);
