INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at) VALUES('core.cross-component',86400000,0);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.cross-component','student.withdrawn',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.cross-component','student.reinstated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.cross-component','staff.withdrawn',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.cross-component','staff.reinstated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.cross-component','room.updated',5000);
INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms) VALUES('core.cross-component','item.updated',5000);
