INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at) VALUES('cover.operations',86400000,0);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.demand.created',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.demand.cancelled',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.demand.reinstated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.assignment.confirmed',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.assignment.overridden',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.assignment.reassigned',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('cover.operations','cover.assignment.cancelled',5000);
