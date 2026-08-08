-- Path: /home/tmax/TimSyS_v6/platform/modules/notification/migrations/001_notifications.sql
-- Migration: notification_001_init
-- Purpose: User and role-targeted notifications with lifecycle management

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    role_target TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'system',
    severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'critical')),
    source_type TEXT,
    source_id TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_role ON notifications(role_target);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notif_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notif_severity ON notifications(severity);
