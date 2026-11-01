CREATE TABLE IF NOT EXISTS service_host_contracts (
  service_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  contract_hash TEXT NOT NULL,
  contract_json TEXT NOT NULL,
  PRIMARY KEY(service_id,contract_version)
);
CREATE TABLE IF NOT EXISTS service_host_calls (
  request_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  contract_hash TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed','interrupted')),
  error_code TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS service_host_calls_owner ON service_host_calls(app_id,user_id,started_at);
