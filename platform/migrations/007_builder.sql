-- Migration: 007_builder
-- Created: 2026-08-06
-- Purpose: Component registry and module template storage for builder module

-- ============================================================================
-- COMPONENT REGISTRY (used by componentRegistry.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS component_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'generic',
    owner_module TEXT,
    dependencies TEXT NOT NULL DEFAULT '[]',
    routes TEXT,
    schema TEXT,
    capabilities TEXT,
    events TEXT,
    registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_component_registry_name ON component_registry(name);
CREATE INDEX IF NOT EXISTS idx_component_registry_type ON component_registry(type);
CREATE INDEX IF NOT EXISTS idx_component_registry_owner ON component_registry(owner_module);

-- ============================================================================
-- MODULE TEMPLATES (used by templates.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS module_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    completion_state INTEGER NOT NULL,
    description TEXT,
    manifest_template TEXT,
    files TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_module_templates_name ON module_templates(name);
CREATE INDEX IF NOT EXISTS idx_module_templates_completion ON module_templates(completion_state);