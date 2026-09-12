CREATE TABLE IF NOT EXISTS standards_ontology_builds (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL DEFAULT 'principal-ed', framework_id INTEGER NOT NULL,
 version INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'building' CHECK(status IN ('building','ready','failed','superseded')),
 algorithm_version TEXT NOT NULL, statement_count INTEGER NOT NULL DEFAULT 0, node_count INTEGER NOT NULL DEFAULT 0,
 relation_count INTEGER NOT NULL DEFAULT 0, notes TEXT, built_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), completed_at TEXT,
 UNIQUE(app_id,framework_id,version), FOREIGN KEY(framework_id) REFERENCES standards_repository_frameworks(id)
);
CREATE TABLE IF NOT EXISTS standards_ontology_nodes (
 id INTEGER PRIMARY KEY AUTOINCREMENT, build_id INTEGER NOT NULL, framework_id INTEGER NOT NULL,
 statement_id INTEGER, node_type TEXT NOT NULL CHECK(node_type IN ('standard','concept','function','evidence','grade','domain','strand')),
 canonical_key TEXT NOT NULL, label TEXT NOT NULL, description TEXT, aliases_json TEXT NOT NULL DEFAULT '[]',
 provenance_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(build_id,node_type,canonical_key), FOREIGN KEY(build_id) REFERENCES standards_ontology_builds(id),
 FOREIGN KEY(framework_id) REFERENCES standards_repository_frameworks(id), FOREIGN KEY(statement_id) REFERENCES standards_repository_statements(id)
);
CREATE TABLE IF NOT EXISTS standards_ontology_relations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, build_id INTEGER NOT NULL, source_node_id INTEGER NOT NULL, target_node_id INTEGER NOT NULL,
 relation_type TEXT NOT NULL CHECK(relation_type IN ('contains','requires','expresses','evidenced_by','related_to','broader_than','narrower_than')),
 weight REAL NOT NULL DEFAULT 1, rationale TEXT NOT NULL, provenance_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(build_id,source_node_id,target_node_id,relation_type),
 FOREIGN KEY(build_id) REFERENCES standards_ontology_builds(id), FOREIGN KEY(source_node_id) REFERENCES standards_ontology_nodes(id),
 FOREIGN KEY(target_node_id) REFERENCES standards_ontology_nodes(id)
);
CREATE INDEX IF NOT EXISTS idx_ontology_build ON standards_ontology_builds(app_id,framework_id,status);
CREATE INDEX IF NOT EXISTS idx_ontology_node_lookup ON standards_ontology_nodes(build_id,node_type,canonical_key);
CREATE INDEX IF NOT EXISTS idx_ontology_relation_source ON standards_ontology_relations(build_id,source_node_id,relation_type);
