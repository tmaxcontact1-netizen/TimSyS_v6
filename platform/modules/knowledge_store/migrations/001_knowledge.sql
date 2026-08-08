-- Path: /home/tmax/TimSyS_v6/platform/modules/knowledge_store/migrations/001_knowledge.sql
-- Migration: knowledge_store_001_init
-- Purpose: Policy, procedure, precedent repository with versioning and search

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('policy', 'procedure', 'precedent', 'guideline')),
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'approved', 'archived')),
    effective_date TEXT,
    expiry_date TEXT,
    author_id TEXT,
    author_name TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    parent_document_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_document_id) REFERENCES knowledge_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_documents(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_effective ON knowledge_documents(effective_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_expiry ON knowledge_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_parent ON knowledge_documents(parent_document_id);
