'use strict';

const helper = require('../../helpers/test-server');

describe('calendar planner', function() {
  let context, token;
  beforeAll(async function() {
    context = await helper.createTestServer('calendar');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
  });
  afterAll(async function() { if (context) await context.cleanup(); });

  test('supports explicit calendar and academic year boundaries', async function() {
    const response = await context.makeRequest('PUT', '/calendar/settings', { locale:'en-GB', timezone:'Asia/Riyadh', calendar_start:'01-01', calendar_end:'12-31', academic_start:'07-15', academic_end:'06-30' }, token);
    expect(response.status).toBe(200);
    expect(response.data.settings.calendar_system).toBe('gregorian');
    expect(response.data.settings.academic_start).toBe('07-15');
    expect(response.data.settings.academic_end).toBe('06-30');
    expect(response.data.settings.academic_start_month).toBe(7);
  });

  test('recurs internally, publishes deliberately and rolls over as drafts', async function() {
    const created = await context.makeRequest('POST', '/calendar/entries', {
      title:'Weekly briefing', primary_layer:'leadership', start_at:'2026-09-01T08:00:00.000Z', end_at:'2026-09-01T09:00:00.000Z',
      recurrence:{frequency:'weekly',interval:1,count:4}, visibility_roles:['superuser','principal'], rollover_strategy:'same_date'
    }, token);
    expect(created.status).toBe(200);
    const id = created.data.entry.id;
    const internal = await context.makeRequest('GET', '/calendar/entries?from=2026-09-01T00:00:00.000Z&to=2026-10-01T00:00:00.000Z', null, token);
    expect(internal.data.entries).toHaveLength(4);
    expect(internal.data.entries[1].series_start_at).toBe('2026-09-01T08:00:00.000Z');
    let outward = await context.makeRequest('GET', '/public/calendar', null, null);
    expect(outward.data.entries).toHaveLength(0);
    expect((await context.makeRequest('POST', '/calendar/entries/'+id+'/publish', {public_title:'Community briefing'}, token)).status).toBe(200);
    outward = await context.makeRequest('GET', '/public/calendar', null, null);
    expect(outward.data.entries[0].title).toBe('Community briefing');
    const rollover = await context.makeRequest('POST', '/calendar/rollover', {target_year:2027}, token);
    expect(rollover.data.total).toBe(1);
    expect(rollover.data.created[0].status).toBe('draft');
    expect(rollover.data.created[0].public_enabled).toBe(false);
  });

  test('accepts neutral source links without owning the producer workflow', async function() {
    const created = await context.makeRequest('POST', '/calendar/entries', {
      title:'Field trip departure', primary_layer:'academic', start_at:'2026-11-04T05:00:00.000Z', end_at:'2026-11-04T06:00:00.000Z',
      source_component:'event_record', source_record_id:'trip-42', source_type:'departure', visibility_roles:['superuser','principal']
    }, token);
    expect(created.status).toBe(200);
    expect(created.data.entry.source_component).toBe('event_record');
    expect(created.data.entry).not.toHaveProperty('checklist');
    expect(created.data.entry).not.toHaveProperty('inventory_ids');
  });

  test('supports conflicts, occurrence exceptions, lifecycle, audit and publication withdrawal', async function() {
    const created = await context.makeRequest('POST', '/calendar/entries', {title:'Controlled observation',primary_layer:'academic_management',start_at:'2026-12-01T08:00:00.000Z',end_at:'2026-12-01T09:00:00.000Z',recurrence:{frequency:'weekly',count:2},visibility_roles:['superuser','principal']}, token);
    const entry = created.data.entry;
    const conflicts = await context.makeRequest('GET', '/calendar/conflicts?from=2026-12-01T08:30:00.000Z&to=2026-12-01T09:30:00.000Z', null, token);
    expect(conflicts.data.conflicts.map(function(x){return x.id;})).toContain(entry.id);
    expect((await context.makeRequest('POST','/calendar/entries/'+entry.id+'/exceptions',{original_start_at:'2026-12-08T08:00:00.000Z',action:'cancelled',reason:'Changed plan'},token)).status).toBe(200);
    const occurrences = await context.makeRequest('GET','/calendar/entries?from=2026-12-01T00:00:00.000Z&to=2026-12-15T00:00:00.000Z',null,token);
    expect(occurrences.data.entries.filter(function(x){return x.id===entry.id;})).toHaveLength(1);
    expect((await context.makeRequest('PUT','/calendar/entries/'+entry.id+'/status',{status:'cancelled'},token)).data.entry.status).toBe('cancelled');
    await context.makeRequest('POST','/calendar/entries/'+entry.id+'/publish',{},token);
    expect((await context.makeRequest('DELETE','/calendar/entries/'+entry.id+'/publication',{},token)).data.withdrawn).toBe(true);
    const history = await context.makeRequest('GET','/calendar/entries/'+entry.id+'/audit',null,token);
    expect(history.data.audit.length).toBeGreaterThanOrEqual(4);
  });
});
