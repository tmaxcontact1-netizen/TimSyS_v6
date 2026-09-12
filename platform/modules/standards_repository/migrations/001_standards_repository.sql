CREATE TABLE IF NOT EXISTS standards_repository_publishers (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, abbreviation TEXT, jurisdiction TEXT NOT NULL DEFAULT 'United States', website TEXT,
 UNIQUE(name,jurisdiction)
);
CREATE TABLE IF NOT EXISTS standards_repository_frameworks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', publisher_id INTEGER NOT NULL,
 code TEXT NOT NULL, name TEXT NOT NULL, subject TEXT NOT NULL, grade_band TEXT, version_label TEXT NOT NULL,
 effective_from TEXT, effective_to TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','verified','active','superseded','withdrawn')),
 source_document_id INTEGER, source_filename TEXT, source_sha256 TEXT, source_pages INTEGER, extraction_notes TEXT,
 created_by TEXT NOT NULL, verified_by TEXT, verified_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,code,version_label), FOREIGN KEY(publisher_id) REFERENCES standards_repository_publishers(id)
);
CREATE TABLE IF NOT EXISTS standards_repository_statements (
 id INTEGER PRIMARY KEY AUTOINCREMENT, framework_id INTEGER NOT NULL, parent_id INTEGER, code TEXT NOT NULL,
 statement TEXT NOT NULL, description TEXT, grade_label TEXT, strand TEXT, domain TEXT, sequence INTEGER NOT NULL DEFAULT 1,
 source_page INTEGER, source_excerpt TEXT, verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified','flagged')),
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(framework_id,code), FOREIGN KEY(framework_id) REFERENCES standards_repository_frameworks(id), FOREIGN KEY(parent_id) REFERENCES standards_repository_statements(id)
);
CREATE TABLE IF NOT EXISTS standards_repository_ingest_issues (
 id INTEGER PRIMARY KEY AUTOINCREMENT, framework_id INTEGER NOT NULL, statement_id INTEGER, severity TEXT NOT NULL,
 issue_code TEXT NOT NULL, message TEXT NOT NULL, source_page INTEGER, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','accepted')),
 resolution TEXT, resolved_by TEXT, resolved_at TEXT, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(framework_id) REFERENCES standards_repository_frameworks(id), FOREIGN KEY(statement_id) REFERENCES standards_repository_statements(id)
);
CREATE TABLE IF NOT EXISTS standards_repository_statement_revisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, statement_id INTEGER NOT NULL, previous_code TEXT NOT NULL, previous_statement TEXT NOT NULL,
 change_reason TEXT NOT NULL, changed_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(statement_id) REFERENCES standards_repository_statements(id)
);
CREATE INDEX IF NOT EXISTS idx_standard_repo_framework ON standards_repository_frameworks(app_id,subject,status);
CREATE INDEX IF NOT EXISTS idx_standard_repo_statement ON standards_repository_statements(framework_id,domain,strand,grade_label);
CREATE INDEX IF NOT EXISTS idx_standard_repo_revision ON standards_repository_statement_revisions(statement_id,id);
