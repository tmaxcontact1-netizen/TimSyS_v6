-- TimSyS shared world model and decision-support lifecycle.
-- Modules contribute through these canonical contracts; none of these tables is module-owned.

CREATE TABLE IF NOT EXISTS event_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    occurred_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL,
    published_at INTEGER NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    module TEXT,
    actor_id TEXT,
    source TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_event_store_entity ON event_store(entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_event_store_channel ON event_store(channel, occurred_at);

CREATE TABLE IF NOT EXISTS world_entities (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    owning_module TEXT NOT NULL,
    display_name TEXT,
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    facts TEXT NOT NULL DEFAULT '{}',
    data_quality REAL NOT NULL DEFAULT 1.0,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    PRIMARY KEY(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS world_relationships (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    valid_from INTEGER,
    valid_to INTEGER,
    provenance TEXT NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 1.0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_relationship_subject ON world_relationships(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_relationship_object ON world_relationships(object_type, object_id);

CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    knowledge_type TEXT NOT NULL,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL DEFAULT '{}',
    source TEXT,
    owner TEXT,
    scope TEXT NOT NULL DEFAULT '{}',
    authority_level TEXT NOT NULL DEFAULT 'local',
    effective_from INTEGER,
    effective_to INTEGER,
    superseded_by TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS insight_products (
    id TEXT PRIMARY KEY,
    product_type TEXT NOT NULL CHECK(product_type IN ('observation','alert','reminder','recommendation','data_quality')),
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    explanation TEXT,
    evidence TEXT NOT NULL DEFAULT '[]',
    knowledge_refs TEXT NOT NULL DEFAULT '[]',
    possible_actions TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0,
    uncertainty TEXT,
    severity TEXT NOT NULL DEFAULT 'information',
    status TEXT NOT NULL DEFAULT 'detected',
    audience TEXT NOT NULL DEFAULT '[]',
    provider_id TEXT NOT NULL,
    provider_version TEXT NOT NULL,
    detected_at INTEGER NOT NULL,
    review_at INTEGER,
    expires_at INTEGER,
    superseded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_insight_scope ON insight_products(scope_type, scope_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_insight_status ON insight_products(status, product_type);

CREATE TABLE IF NOT EXISTS insight_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('presented','acknowledged','accepted','rejected','deferred','dismissed','actioned','resolved','reopened','superseded')),
    actor_id TEXT NOT NULL,
    rationale TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    acted_at INTEGER NOT NULL,
    FOREIGN KEY(insight_id) REFERENCES insight_products(id)
);
CREATE INDEX IF NOT EXISTS idx_insight_actions_insight ON insight_actions(insight_id, acted_at);

CREATE TABLE IF NOT EXISTS decision_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    context TEXT NOT NULL DEFAULT '{}',
    rationale TEXT,
    outcome TEXT,
    related_decision_id INTEGER,
    related_insight_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX IF NOT EXISTS idx_decision_entity ON decision_log(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS outcome_records (
    id TEXT PRIMARY KEY,
    decision_id INTEGER,
    insight_id TEXT,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT NOT NULL,
    measures TEXT NOT NULL DEFAULT '{}',
    recorded_by TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_snapshots (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    snapshot_type TEXT NOT NULL,
    state TEXT NOT NULL,
    evidence_event_id TEXT,
    captured_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshot_entity ON entity_snapshots(entity_type, entity_id, captured_at);

CREATE TABLE IF NOT EXISTS withdrawal_reasons (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    applies_to TEXT NOT NULL DEFAULT 'all',
    requires_detail INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO withdrawal_reasons(code,label,category,applies_to,requires_detail,sort_order) VALUES
 ('profile_incomplete','Profile incomplete / not ready for active use','administrative','all',0,10),
 ('transferred','Transferred to another school','departure','student',0,20),
 ('relocated','Relocated','departure','student',0,30),
 ('completed','Completed programme or year','departure','student',0,40),
 ('family_decision','Family decision','departure','student',0,50),
 ('health_wellbeing','Health or wellbeing','departure','all',0,60),
 ('attendance','Attendance-related','departure','student',0,70),
 ('behaviour','Behaviour or disciplinary','departure','student',0,80),
 ('safeguarding','Safeguarding','departure','student',0,90),
 ('home_education','Home education','departure','student',0,100),
 ('administrative','Administrative or regulatory','administrative','all',0,110),
 ('unknown','Unknown / not provided','data_quality','all',0,120),
 ('other','Other','other','all',1,130);

CREATE TABLE IF NOT EXISTS entity_withdrawals (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    effective_at INTEGER NOT NULL,
    note TEXT,
    destination TEXT,
    documentation_complete INTEGER,
    actor_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'withdrawn',
    reinstated_at INTEGER,
    reinstated_by TEXT,
    reinstatement_reason TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(reason_code) REFERENCES withdrawal_reasons(code)
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_entity ON entity_withdrawals(entity_type, entity_id, effective_at);
