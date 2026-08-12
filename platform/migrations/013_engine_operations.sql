CREATE TABLE IF NOT EXISTS world_model_backfills (
    id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, completed_at INTEGER, status TEXT NOT NULL,
    boundary_at INTEGER NOT NULL, entities_seen INTEGER NOT NULL DEFAULT 0, entities_imported INTEGER NOT NULL DEFAULT 0,
    relationships_imported INTEGER NOT NULL DEFAULT 0, errors TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS provider_schedules (
    provider_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, interval_ms INTEGER NOT NULL,
    next_run_at INTEGER NOT NULL, last_run_at INTEGER, last_status TEXT, last_error TEXT,
    scope_type TEXT NOT NULL DEFAULT 'organisation', scope_id TEXT NOT NULL DEFAULT 'current'
);
CREATE TABLE IF NOT EXISTS provider_event_triggers (
    provider_id TEXT NOT NULL, channel TEXT NOT NULL, debounce_ms INTEGER NOT NULL DEFAULT 5000,
    enabled INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(provider_id,channel)
);
INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at) VALUES('core.withdrawal-patterns',86400000,0);
INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at) VALUES('core.registry-quality',86400000,0);
INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at) VALUES('core.operational-strengths',86400000,0);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.withdrawal-patterns','student.withdrawn',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.withdrawal-patterns','student.reinstated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.registry-quality','student.created',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.registry-quality','student.updated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.registry-quality','staff.created',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.registry-quality','staff.updated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.operational-strengths','room.created',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.operational-strengths','room.updated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.operational-strengths','item.created',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.operational-strengths','item.updated',5000);

INSERT OR IGNORE INTO knowledge_items(id,knowledge_type,name,version,content,source,owner,scope,authority_level,effective_from,enabled,created_at,updated_at)
VALUES('core.withdrawal-patterns.thresholds','analysis_thresholds','Withdrawal pattern thresholds',1,
'{"increase":{"minimumCurrent":3,"minimumAbsoluteChange":2,"minimumRatio":1.5},"decrease":{"minimumPrevious":3,"minimumAbsoluteChange":2,"maximumRatio":0.7},"concentration":{"minimumCount":3}}',
'TimSyS initial defaults','local-desktop-owner','{"providerId":"core.withdrawal-patterns"}','local',0,1,0,0);
