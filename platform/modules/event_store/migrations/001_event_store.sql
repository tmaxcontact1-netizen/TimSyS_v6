-- Path: /home/tmax/TimSyS_v6/platform/modules/event_store/migrations/001_event_store.sql
-- Migration: event_store_001_init
-- Purpose: Persistent event timeline for all EventBus publications

CREATE TABLE IF NOT EXISTS event_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    published_at INTEGER NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    module TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_store_channel ON event_store(channel);
CREATE INDEX IF NOT EXISTS idx_event_store_published ON event_store(published_at);
CREATE INDEX IF NOT EXISTS idx_event_store_entity ON event_store(entity_type, entity_id);
