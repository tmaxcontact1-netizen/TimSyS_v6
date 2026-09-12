CREATE TABLE IF NOT EXISTS document_extraction_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, document_id INTEGER NOT NULL, document_version_id INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','completed','empty','unsupported','failed')), extractor_version TEXT NOT NULL,
 used_ocr INTEGER NOT NULL DEFAULT 0, warning_json TEXT NOT NULL DEFAULT '[]', error_message TEXT,
 requested_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), completed_at TEXT,
 FOREIGN KEY(document_id) REFERENCES documents(id), FOREIGN KEY(document_version_id) REFERENCES document_versions(id)
);
CREATE TABLE IF NOT EXISTS document_extraction_segments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, ordinal INTEGER NOT NULL, kind TEXT NOT NULL,
 content TEXT NOT NULL, content_hash TEXT NOT NULL, locator_json TEXT NOT NULL DEFAULT '{}', confidence REAL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(run_id,ordinal), FOREIGN KEY(run_id) REFERENCES document_extraction_runs(id)
);
CREATE TABLE IF NOT EXISTS document_extraction_assets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, ordinal INTEGER NOT NULL, asset_type TEXT NOT NULL,
 locator_json TEXT NOT NULL DEFAULT '{}', description TEXT, review_required INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(run_id,ordinal), FOREIGN KEY(run_id) REFERENCES document_extraction_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_document_extraction_document ON document_extraction_runs(app_id,document_id,id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_segments ON document_extraction_segments(run_id,ordinal);
CREATE INDEX IF NOT EXISTS idx_document_extraction_assets ON document_extraction_assets(run_id,ordinal);
