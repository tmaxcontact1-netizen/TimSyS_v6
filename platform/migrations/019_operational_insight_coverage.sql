INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at)
VALUES('core.component-operations',86400000,0);
INSERT OR IGNORE INTO provider_schedules(provider_id,interval_ms,next_run_at)
VALUES('principal.operations',3600000,0);

INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms)
SELECT 'core.component-operations', channel, 5000 FROM (
  SELECT 'student.created' channel UNION SELECT 'student.updated' UNION SELECT 'student.withdrawn' UNION SELECT 'student.reinstated'
  UNION SELECT 'staff.created' UNION SELECT 'staff.updated' UNION SELECT 'staff.withdrawn' UNION SELECT 'staff.reinstated'
  UNION SELECT 'room.created' UNION SELECT 'room.updated' UNION SELECT 'item.created' UNION SELECT 'item.updated'
);

INSERT OR IGNORE INTO provider_event_triggers(provider_id,channel,debounce_ms)
SELECT 'principal.operations', channel, 5000 FROM (
  SELECT 'cover.demand.created' channel UNION SELECT 'cover.assignment.confirmed'
  UNION SELECT 'student.withdrawn' UNION SELECT 'student.reinstated'
);
