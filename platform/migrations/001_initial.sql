-- Migration: 001_initial
-- Created: 2026-07-16
-- Purpose: Base tables for platform services, registries, and infrastructure

-- ============================================================================
-- SESSION MANAGEMENT (used by session.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- AUDIT LOG (used by audit.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_log(entity_type);

-- ============================================================================
-- METRICS STORAGE (used by metrics.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    tags TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics_metric_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);

-- ============================================================================
-- TOKEN REVOCATION (used by auth.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_revocation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL,
    revoked_at INTEGER NOT NULL,
    user_id TEXT,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_token_revocation_token_hash ON token_revocation(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_revocation_user_id ON token_revocation(user_id);

-- ============================================================================
-- MODULE REGISTRY (used by moduleRegistry.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS module_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    version TEXT NOT NULL,
    author TEXT,
    status TEXT NOT NULL DEFAULT 'registered',
    metadata TEXT,
    registered_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_module_registry_status ON module_registry(status);

-- ============================================================================
-- SCHEMA REGISTRY (used by schemaRegistry.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT UNIQUE NOT NULL,
    owner_module TEXT NOT NULL,
    migrations TEXT,
    registered_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_schema_registry_owner ON schema_registry(owner_module);

-- ============================================================================
-- ROUTE REGISTRY (used by routeRegistry.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS route_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    handler TEXT NOT NULL,
    auth_required INTEGER DEFAULT 0,
    module_name TEXT NOT NULL,
    registered_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_route_unique ON route_registry(method, path);
CREATE INDEX IF NOT EXISTS idx_route_module ON route_registry(module_name);

-- ============================================================================
-- FUNCTION REGISTRY (used by functionRegistry.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS function_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    module_name TEXT NOT NULL,
    metadata TEXT,
    registered_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_function_module ON function_registry(module_name);

-- ============================================================================
-- CAPABILITY REGISTRY (used by capabilityRegistry.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    module_name TEXT NOT NULL,
    metadata TEXT,
    registered_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_capability_module ON capability_registry(module_name);