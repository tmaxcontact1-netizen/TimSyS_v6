'use strict';
const { randomUUID, createHash } = require('crypto');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const clone = x => JSON.parse(JSON.stringify(x));
const text = (v, max = 6000) => { if (typeof v !== 'string' || v.length > max)
    fail('Enter valid text (maximum ' + max + ' characters).'); return v.trim(); };
const defaults = () => ({ revision: 0, timezone: 'Asia/Riyadh', workingDays: [0, 1, 2, 3, 4], dayStart: '07:00', dayEnd: '17:00', durationMinutes: 60, candidateTimes: ['09:00','10:00','11:00','12:00'], tboVisits: 4, probationMonths: 3, permissions: { view: ['admin', 'observer', 'observee'], contribute: ['admin', 'observer'], reopen: ['admin', 'observer', 'observee'], delete: ['admin'] }, templates: [{ id: 'tbo', name: 'Teaching and learning observation', revision: 1, areas: [] }, { id: 'probation', name: 'Probation review', revision: 1, areas: [] }] });
function settings(value) { const s = {...defaults(),...clone(value)};
 if(!Array.isArray(s.candidateTimes)||!s.candidateTimes.length||s.candidateTimes.length>48||s.candidateTimes.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)||t<s.dayStart||t>=s.dayEnd))fail('Choose candidate start times within working hours.');
 for(const k of ['tboVisits','probationMonths'])if(!Number.isInteger(s[k])||s[k]<1||s[k]>12)fail('Cycle counts must be between 1 and 12.'); try {
    new Intl.DateTimeFormat('en', { timeZone: s.timezone }).format();
}
catch {
    fail('Choose a valid time zone.');
} if (!Array.isArray(s.workingDays) || !s.workingDays.length || s.workingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6))
    fail('Choose working days.'); if (![s.dayStart, s.dayEnd].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || s.dayEnd <= s.dayStart)
    fail('Choose valid working hours.'); if (!Number.isInteger(s.durationMinutes) || s.durationMinutes < 5 || s.durationMinutes > 480)
    fail('Duration must be 5–480 minutes.'); for (const action of ['view', 'contribute', 'reopen', 'delete']) {
    const roles = s.permissions?.[action];
    if (!Array.isArray(roles) || !roles.includes('admin') || roles.some(r => !['admin', 'observer', 'observee'].includes(r)))
        fail('Each permission must include admin and contain recognised roles.');
} if (['contribute', 'reopen'].some(action => s.permissions[action].some(role => !s.permissions.view.includes(role))))
    fail('Anyone who can contribute or reopen must also be allowed to view.'); if (s.permissions.delete.length !== 1)
    fail('Permanent deletion remains admin-only.'); if (!Array.isArray(s.templates) || !s.templates.length || s.templates.length > 30)
    fail('Provide 1–30 templates.'); const ids = new Set(); for (const t of s.templates) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(t.id) || ids.has(t.id))
        fail('Template IDs must be unique.');
    ids.add(t.id);
    t.name = text(t.name, 160);
    if (!t.name || !Array.isArray(t.areas) || t.areas.length > 100)
        fail('Give each template a name and up to 100 areas.');
    t.areas = t.areas.map(a => text(a, 200)).filter(Boolean);
    if (new Set(t.areas).size !== t.areas.length)
        fail('Template areas must be distinct.');
} return s; }
function allowed(s, who, policy, action) { const roles = who.admin ? ['admin'] : who.staffId ? [...(s.observer_ids.includes(who.staffId) ? ['observer'] : []), ...(s.teacher_id === who.staffId ? ['observee'] : [])] : []; return roles.some(r => policy.permissions[action].includes(r)); }
function window(value) { if (!value?.start_at && !value?.end_at)
    return null; if (!/T.*(Z|[+-]\d\d:\d\d)$/.test(value.start_at || '') || !/T.*(Z|[+-]\d\d:\d\d)$/.test(value.end_at || ''))
    fail('Booking times require a time-zone offset.'); const a = new Date(value.start_at), b = new Date(value.end_at); if (!Number.isFinite(+a) || !Number.isFinite(+b) || a >= b || b - a > 8 * 3600000)
    fail('Choose a valid booking of up to eight hours.'); return { start_at: a.toISOString(), end_at: b.toISOString(), lesson_id: value.lesson_id ? String(value.lesson_id) : null }; }
function newRecord(b, policy, people) { const template = policy.templates.find(t => t.id === b.template_id); if (!template)
    fail('Choose a template.'); if (!people.some(p => p.id === b.teacher_id && p.active))
    fail('Choose an active teacher.'); if (!Array.isArray(b.observer_ids) || !b.observer_ids.length || b.observer_ids.some(id => id === b.teacher_id || !people.some(p => p.id === id && p.active)) || new Set(b.observer_ids).size !== b.observer_ids.length)
    fail('Choose distinct active observers other than the teacher.'); return { id: randomUUID(), revision: 1, teacher_id: b.teacher_id, observer_ids: b.observer_ids, title: text(b.title, 200) || template.name, template: clone(template), stage: 'draft', booking: window(b.booking), evidence: [], reviews: [], followup: null, created_at: new Date().toISOString() }; }
const fingerprint = s => createHash('sha256').update(JSON.stringify(s.evidence)).digest('hex');
function mutate(old, b, actor) {
    const s = clone(old), now = new Date().toISOString();
    if (b.action === 'reopen') {
        if (s.stage !== 'reviewed')
            fail('Only a reviewed observation can reopen.', 409);
        if (!text(b.reason || ''))
            fail('Give a reason for reopening.');
        s.stage = 'draft';
    }
    else if (b.action === 'booking') {
        if (s.stage !== 'draft')
            fail('Reopen before changing the booking.', 409);
        s.booking = window(b.booking);
    }
    else if (b.action === 'evidence') {
        if (s.stage !== 'draft')
            fail('Reopen before changing evidence.', 409);
        const wording = text(b.text);
        if (!wording)
            fail('Enter evidence.');
        const area = text(b.area || '', 200);
        if (area && !s.template.areas.includes(area))
            fail('Choose an area from this observation’s template.');
        s.evidence.push({ id: randomUUID(), text: wording, area, by: actor, at: now });
    }
    else if (b.action === 'review') {
        if (s.stage !== 'draft' || !s.evidence.length)
            fail('A draft needs evidence before review.', 409);
        const conclusion = text(b.conclusion);
        if (!conclusion)
            fail('Enter a review conclusion.');
        s.reviews.push({ id: randomUUID(), conclusion, evidence_hash: fingerprint(s), by: actor, at: now });
        s.stage = 'reviewed';
    }
    else if (b.action === 'followup') {
        const f = b.followup || {}, claims = ['not_assessed', 'insufficient_evidence', 'possible_contribution', 'supported_contribution', 'no_contribution_identified'];
        if (!claims.includes(f.contribution))
            fail('Choose a contribution judgment.');
        const next = {};
        for (const k of ['activity', 'expected_change', 'application', 'observed_change', 'other_influences', 'rationale'])
            next[k] = text(f[k] || '');
        if (!next.activity || !next.expected_change)
            fail('Describe the development activity and expected change.');
        if (!Array.isArray(f.evidence_ids) || f.evidence_ids.some(id => !s.evidence.some(e => e.id === id)))
            fail('Choose existing evidence references.');
        if (f.contribution === 'supported_contribution' && (!f.evidence_ids.length || !next.application || !next.other_influences || !next.rationale))
            fail('A supported contribution judgment requires evidence, classroom application, consideration of other influences and a rationale.');
        s.followup = { ...next, evidence_ids: [...new Set(f.evidence_ids)], contribution: f.contribution, causation_established: false, by: actor, at: now };
    }
    else
        fail('Unknown observation action.');
    s.revision++;
    s.updated_at = now;
    return s;
}
module.exports = { fail, clone, text, defaults, settings, allowed, window, newRecord, mutate };
