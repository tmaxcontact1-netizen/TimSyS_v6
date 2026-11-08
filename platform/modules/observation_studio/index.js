'use strict';
const crypto = require('crypto'), E = require('./engine'), scope = require('../../shared/services/appScope');
const parse = r => r && JSON.parse(r.data_json);
function policy(ctx, app) { return {...E.defaults(),...parse(ctx.db.query('SELECT data_json FROM observation_settings WHERE app_id=?', [app]).rows[0])}; }
function people(ctx) { return ctx.db.query('SELECT s.staff_id,s.user_id,s.first_name,s.last_name,s.employment_status,u.external_id,u.status AS account_status FROM staff s LEFT JOIN users u ON u.id=s.user_id').rows.map(p => ({ id: p.staff_id, actor_id: p.external_id || p.user_id, name: p.first_name + ' ' + p.last_name, active: ['active', 'contract'].includes(p.employment_status) && p.account_status !== 'disabled' })); }
function who(req, ctx, ps) { const matches = ps.filter(p => p.actor_id != null && String(p.actor_id) === String(req.user.id) && p.active); return { admin: ctx.auth.checkPerm(req.user, 'admin:observation-studio:manage'), staffId: matches.length === 1 ? matches[0].id : null }; }
function rows(ctx, app) { return ctx.db.query('SELECT data_json FROM observation_records WHERE app_id=?', [app]).rows.map(parse); }
function load(ctx, app, id) { const r = parse(ctx.db.query('SELECT data_json FROM observation_records WHERE id=? AND app_id=?', [id, app]).rows[0]); if (!r)
    E.fail('Observation not found.', 404); return r; }
function permit(s, w, p, action) { if (!E.allowed(s, w, p, action))
    E.fail('You do not have permission for this observation action.', 403); }
function present(s, w, p) { return { ...s, can: Object.fromEntries(['view', 'contribute', 'reopen', 'delete'].map(a => [a, E.allowed(s, w, p, a)])) }; }
const wrap = fn => async (req, ctx) => { try {
    if (!req.user)
        E.fail('Sign in first.', 401);
    return fn(req, ctx, scope.fromRequest(req));
}
catch (e) {
    if (!e.status && e.code !== 'INVALID_APP_SCOPE')
        throw e;
    return { success: false, statusCode: e.status || 400, error: { code: e.status === 409 ? 'CONFLICT' : 'OBSERVATION_ERROR', message: e.message } };
} };
function availability(ctx, app, s, p) {
    if (!s.booking)
        return { conflicts: [], lessons: [] };
    const b = s.booking, start = Date.parse(b.start_at), end = Date.parse(b.end_at), participants = [s.teacher_id, ...s.observer_ids], conflicts = [], lessons = [];
    const overlaps = (a, z) => Date.parse(a) < end && Date.parse(z) > start;
    const parts = d => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(d)).map(x => [x.type, x.value]));
    const a = parts(start), z = parts(end), day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(a.weekday);
    if (!p.workingDays.includes(day) || a.year + a.month + a.day !== z.year + z.month + z.day || a.hour + ':' + a.minute < p.dayStart || z.hour + ':' + z.minute > p.dayEnd)
        conflicts.push('Outside configured working days or hours.');
    for (const r of rows(ctx, app))
        if (r.id !== s.id && r.booking && overlaps(r.booking.start_at, r.booking.end_at) && [r.teacher_id, ...r.observer_ids].some(id => participants.includes(id)))
            conflicts.push('A participant has another observation at this time.');
    const classes = ctx.db.query("SELECT i.id AS occurrence_id,i.start_at,i.end_at,i.status AS occurrence_status,e.id AS entry_id,e.title,e.status AS entry_status,p.staff_ids_json,x.action,x.replacement_start_at,x.replacement_end_at FROM calendar_instances i JOIN calendar_entries e ON e.id=i.entry_id JOIN scheduler_publication_links l ON l.calendar_entry_id=e.id JOIN scheduler_placements p ON p.id=l.placement_id LEFT JOIN calendar_exceptions x ON x.entry_id=e.id AND x.original_start_at=i.start_at WHERE e.app_id=? AND e.status!='cancelled' AND i.status!='cancelled'", [app]).rows;
    for (const c of classes) {
        if (c.action === 'cancelled')
            continue;
        const from = c.action === 'rescheduled' ? c.replacement_start_at : c.start_at, to = c.action === 'rescheduled' ? c.replacement_end_at : c.end_at;
        if (!overlaps(from, to))
            continue;
        const staff = JSON.parse(c.staff_ids_json), id = String(c.occurrence_id);
        if (staff.includes(s.teacher_id) && Date.parse(from) <= start && Date.parse(to) >= end)
            lessons.push({ id, title: c.title, start_at: from, end_at: to });
        for (const person of staff.filter(id => participants.includes(id))) {
            if (person === s.teacher_id && b.lesson_id === id && lessons.some(l => l.id === id))
                continue;
            conflicts.push(person === s.teacher_id ? 'The teacher has a class. Select it as the observed lesson if appropriate.' : 'An observer has a class at this time.');
        }
    }
    if (b.lesson_id && !lessons.some(l => l.id === b.lesson_id))
        conflicts.push('The selected observed lesson no longer matches this teacher and time.');
    const cover = ctx.db.query("SELECT a.candidate_ref,a.candidate_type,d.starts_at,d.ends_at FROM cover_assignments a JOIN cover_demands d ON d.id=a.cover_demand_id WHERE a.app_id=? AND d.app_id=? AND a.status='active' AND d.status NOT IN ('cancelled','closed')", [app, app]).rows;
    for (const c of cover)
        if (participants.includes(c.candidate_ref) && overlaps(c.starts_at, c.ends_at))
            conflicts.push('A participant has a cover assignment at this time.');
    const absences = ctx.db.query("SELECT staff_id,starts_at,ends_at FROM cover_absences WHERE app_id=? AND status IN ('reported','confirmed')", [app]).rows;
    for (const x of absences)
        if (participants.includes(x.staff_id) && Date.parse(x.starts_at) < end && (!x.ends_at || Date.parse(x.ends_at) > start))
            conflicts.push('A participant is recorded absent at this time.');
    return { conflicts: [...new Set(conflicts)], lessons };
}
function audit(ctx, app, id, actor, action, revision, detail) { ctx.db.query('INSERT INTO observation_audit(app_id,record_id,actor_id,action,revision,detail_json) VALUES(?,?,?,?,?,?)', [app, id, actor, action, revision, JSON.stringify(detail)]); }
function transaction(req, ctx, app, fn) {
    const b = req.body || {}, id = b.command_id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(id))
        E.fail('A stable command ID is required.');
    const actor = String(req.user.id), hash = crypto.createHash('sha256').update(JSON.stringify({ target: req.params?.id || null, ...b })).digest('hex');
    return ctx.db.transaction(() => {
        ctx.db.query('INSERT OR IGNORE INTO observation_settings(app_id,revision,data_json) VALUES(?,?,?)', [app, 0, JSON.stringify(E.defaults())]);
        // Serialise this module's booking checks and writes, including on PostgreSQL.
        ctx.db.query('UPDATE observation_settings SET revision=revision WHERE app_id=?', [app]);
        const receipt = ctx.db.query('SELECT * FROM observation_receipts WHERE app_id=? AND command_id=?', [app, id]).rows[0];
        if (receipt && (receipt.actor_id !== actor || receipt.payload_hash !== hash))
            E.fail('Command ID was already used for a different request.', 409);
        const result = fn(receipt, actor);
        if (!receipt)
            ctx.db.query('INSERT INTO observation_receipts(app_id,command_id,actor_id,payload_hash,record_id) VALUES(?,?,?,?,?)', [app, id, actor, hash, result.record?.id || null]);
        return result;
    });
}
const workspace = wrap((req, ctx, app) => { const ps = people(ctx), w = who(req, ctx, ps), p = policy(ctx, app); if (!w.admin && !w.staffId)
    E.fail('Link this account to a staff profile before opening observations.', 403); const records = rows(ctx, app).filter(s => E.allowed(s, w, p, 'view')).map(s => ({ ...present(s, w, p), availability: availability(ctx, app, s, p) })); return { success: true, settings: p, admin: w.admin, people: ps.map(({ id, name, active }) => ({ id, name, active })), records }; });
const saveSettings = wrap((req, ctx, app) => transaction(req, ctx, app, (receipt, actor) => { if (!who(req, ctx, people(ctx)).admin)
    E.fail('Only an administrator can change observation settings.', 403); const old = policy(ctx, app); if (receipt)
    return { success: true, settings: old }; if (req.body.expected_revision !== old.revision)
    E.fail('Settings changed. Reload before saving.', 409); const next = E.settings(req.body.settings); next.revision = old.revision + 1; next.templates = next.templates.map(t => ({ ...t, revision: (old.templates.find(x => x.id === t.id)?.revision || 0) + 1 })); ctx.db.query('UPDATE observation_settings SET revision=?,data_json=? WHERE app_id=?', [next.revision, JSON.stringify(next), app]); audit(ctx, app, null, actor, 'settings', next.revision, { before: old, after: next }); return { success: true, settings: next }; }));
const create = wrap((req, ctx, app) => transaction(req, ctx, app, (receipt, actor) => { const ps = people(ctx), w = who(req, ctx, ps), p = policy(ctx, app); if (!w.admin)
    E.fail('Only an administrator can assign a new observation.', 403); if (receipt) {
    const s = load(ctx, app, receipt.record_id);
    return { success: true, record: present(s, w, p) };
} const s = E.newRecord(req.body, p, ps), check = availability(ctx, app, s, p); if (check.conflicts.length)
    E.fail(check.conflicts.join(' '), 409); ctx.db.query('INSERT INTO observation_records(id,app_id,revision,data_json) VALUES(?,?,?,?)', [s.id, app, s.revision, JSON.stringify(s)]); audit(ctx, app, s.id, actor, 'create', s.revision, { after: s }); return { success: true, record: present(s, w, p) }; }));
const preview = wrap((req, ctx, app) => { const ps = people(ctx), w = who(req, ctx, ps), p = policy(ctx, app); let s; if (req.body.id) {
    s = load(ctx, app, req.body.id);
    permit(s, w, p, 'contribute');
    s = { ...s, booking: E.window(req.body.booking) };
}
else {
    if (!w.admin)
        E.fail('Only an administrator can assign an observation.', 403);
    s = E.newRecord(req.body, p, ps);
} return { success: true, ...availability(ctx, app, s, p) }; });
const command = wrap((req, ctx, app) => transaction(req, ctx, app, (receipt, actor) => {
    const p = policy(ctx, app), w = who(req, ctx, people(ctx)), b = req.body, action = b.action === 'delete' ? 'delete' : b.action === 'reopen' ? 'reopen' : 'contribute';
    if (receipt && b.action === 'delete') {
        if (!w.admin)
            E.fail('Administrator required.', 403);
        return { success: true, deleted: true };
    }
    const old = load(ctx, app, req.params.id);
    permit(old, w, p, action);
    if (receipt)
        return { success: true, record: present(old, w, p) };
    if (b.expected_revision !== old.revision)
        E.fail('This observation changed. Your draft has not been saved; refresh and review before retrying.', 409);
    if (b.action === 'delete') {
        if (b.confirm_id !== old.id)
            E.fail('Confirm the observation ID before permanent deletion.');
        ctx.db.query('DELETE FROM observation_records WHERE id=? AND app_id=?', [old.id, app]);
        ctx.db.query('DELETE FROM observation_audit WHERE record_id=? AND app_id=?', [old.id, app]);
        audit(ctx, app, old.id, actor, 'permanent_delete', old.revision + 1, { id: old.id });
        return { success: true, deleted: true };
    }
    const next = E.mutate(old, b, actor);
    if (b.action === 'booking') {
        const check = availability(ctx, app, next, p);
        if (check.conflicts.length)
            E.fail(check.conflicts.join(' '), 409);
    }
    ctx.db.query('UPDATE observation_records SET revision=?,data_json=? WHERE id=? AND app_id=? AND revision=?', [next.revision, JSON.stringify(next), old.id, app, old.revision]);
    audit(ctx, app, next.id, actor, b.action, next.revision, { before: old, after: next, reason: b.reason || null });
    return { success: true, record: present(next, w, p) };
}));
const history = wrap((req, ctx, app) => { const p = policy(ctx, app), w = who(req, ctx, people(ctx)), s = load(ctx, app, req.params.id); permit(s, w, p, 'view'); return { success: true, history: ctx.db.query('SELECT actor_id,action,revision,detail_json,created_at FROM observation_audit WHERE app_id=? AND record_id=? ORDER BY id', [app, s.id]).rows.map(r => ({ ...r, detail: JSON.parse(r.detail_json), detail_json: undefined })) }; });
const fullRpc=wrap((req,ctx,app)=>{try{return require('./studio-rpc').handle(req,ctx,app);}catch(e){if(!e.status&&!e.code)e.status=400;throw e;}});
const access=wrap((req,ctx,app)=>{const w=who(req,ctx,people(ctx));return {success:true,enabled:!!(w.admin||w.staffId)&&!!ctx.db.query("SELECT 1 FROM app_module_assignments WHERE app_id=? AND module_name='observation_studio'",[app]).rows.length};});
module.exports = { access, fullRpc, internals:{policy,people,who,rows,load,permit,availability,audit}, boot() { }, teardown() { }, workspace, saveSettings, create, preview, command, history, availability };
