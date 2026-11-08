CREATE TABLE IF NOT EXISTS observation_stores (
 app_id TEXT NOT NULL, store_key TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(app_id,store_key)
);
CREATE TABLE IF NOT EXISTS observation_rpc_receipts (
 app_id TEXT NOT NULL, command_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 payload_hash TEXT NOT NULL, record_id TEXT, result_json TEXT NOT NULL,
 PRIMARY KEY(app_id,command_id)
);
