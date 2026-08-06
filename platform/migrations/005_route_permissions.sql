-- Migration: 005_route_permissions
-- Created: 2026-07-19
-- Purpose: Add permissions column to route_registry table for route-level authorization

CREATE TABLE IF NOT EXISTS route_permissions_backup AS SELECT * FROM route_registry WHERE 0;

PRAGMA foreign_keys = OFF;

CREATE TABLE route_registry_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    handler TEXT NOT NULL,
    auth_required INTEGER DEFAULT 0,
    module_name TEXT NOT NULL,
    permissions TEXT,
    registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(method, path)
);

INSERT INTO route_registry_new (id, method, path, handler, auth_required, module_name, permissions, registered_at)
SELECT id, method, path, handler, auth_required, module_name, NULL, registered_at 
FROM route_registry;

DROP TABLE route_registry;

ALTER TABLE route_registry_new RENAME TO route_registry;

CREATE INDEX IF NOT EXISTS idx_route_registry_method_path ON route_registry(method, path);
CREATE INDEX IF NOT EXISTS idx_route_registry_module ON route_registry(module_name);

PRAGMA foreign_keys = ON;