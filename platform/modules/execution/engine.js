'use strict';

const { randomUUID } = require('crypto');
const terminal = t => ['completed', 'cancelled'].includes(t.lifecycle);
function fail(message, status = 422, code = 'EXECUTION_CONSTRAINT') { throw Object.assign(new Error(message), { status, code }); }
function text(value, label, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim())) fail(`${label} must be ${required ? 'non-empty ' : ''}text`);
  return value.trim();
}
function date(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Use a real YYYY-MM-DD date');
  return value;
}
function localDate(timezone, now = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { fail('Choose a valid school timezone'); }
}
function empty(input, actor) {
  if (!input.timezone) fail('School timezone is required');
  localDate(input.timezone);
  return { id: randomUUID(), title: text(input.title, 'Title', true), description: text(input.description, 'Description'), timezone: input.timezone,
    lead_staff_id: input.lead_staff_id || null, academic_year_id: input.academic_year_id || null, target_on: date(input.target_on), lifecycle: 'planning', revision: 1,
    created_by: actor, created_at: new Date().toISOString(), retrospective: '', phases: [], tasks: [], dependencies: [], blockers: [], outcomes: [], milestones: [], exceptions: [], links: [] };
}
function task(s, id) { const value = s.tasks.find(t => t.id === id); if (!value) fail('Task not found in this Work Instance', 404); return value; }
function satisfied(s, e) { const p = task(s, e.from_id); return e.state !== 'active' || (p.lifecycle === 'completed' && (p.kind !== 'decision' || s.outcomes.some(o => o.task_id === p.id && o.cycle === p.cycle && o.outcome === 'approve'))); }
function summary(s, t, people, today) {
  const reasons = [];
  if (s.lifecycle !== 'active') reasons.push({ code: 'INSTANCE', message: `Work Instance is ${s.lifecycle}` });
  for (const b of s.blockers.filter(b => b.task_id === t.id && b.state === 'open')) reasons.push({ code: 'BLOCKER', id: b.id, message: b.reason });
  for (const e of s.exceptions.filter(e => e.task_id === t.id && e.state === 'open')) reasons.push({ code: 'EXCEPTION', id: e.id, message: 'Previously satisfied work changed; resolve the prerequisite or waive it explicitly' });
  for (const e of s.dependencies.filter(e => e.to_id === t.id && !satisfied(s, e))) { const p=task(s,e.from_id),owner=people.find(x=>x.id===p.assignee_staff_id);reasons.push({ code: 'WAITING', id: e.from_id, message: `Waiting for ${p.title}${owner?` — ${owner.name}`:''}` }); }
  if (t.available_on && t.available_on > today) reasons.push({ code: 'DATE', message: `Available ${t.available_on}` });
  const person = people.find(p => p.id === t.assignee_staff_id);
  if (!person || !person.active) reasons.push({ code: 'ASSIGNMENT', message: person ? 'Owner needs reassignment' : 'Assign a person' });
  let state = terminal(t) ? t.lifecycle : s.lifecycle !== 'active' ? s.lifecycle : t.lifecycle === 'in_progress' ? 'in_progress' : reasons.some(r => ['BLOCKER', 'EXCEPTION'].includes(r.code)) ? 'blocked' : reasons.some(r => r.code === 'WAITING') ? 'waiting' : reasons.some(r => r.code === 'DATE') ? 'upcoming' : reasons.some(r => r.code === 'ASSIGNMENT') ? 'unassigned' : 'ready';
  return { ...t, state, reasons, person_name: person?.name || t.assignee_name || null, overdue: !terminal(t) && !!t.due_on && t.due_on < today,
    actionable: !terminal(t) && reasons.length === 0, decision_required: t.kind === 'decision' && state === 'ready' };
}
function project(s, people, today = localDate(s.timezone)) {
  const tasks = s.tasks.map(t => summary(s, t, people, today));
  const schedule_warnings = s.dependencies.filter(e => e.state === 'active').flatMap(e => {
    const p = task(s, e.from_id), n = task(s, e.to_id);
    return p.due_on && (n.available_on || n.due_on) && p.due_on > (n.available_on || n.due_on) ? [{ edge_id: e.id, message: `${p.title} is due after ${n.title} is scheduled to begin` }] : [];
  });
  return { ...s, tasks, local_date: today, generated_at: new Date().toISOString(), schedule_warnings,
    attention: tasks.filter(t => !terminal(t) && (t.overdue || ['blocked', 'unassigned'].includes(t.state) || t.decision_required)).length + s.exceptions.filter(e => e.state === 'open' && terminal(task(s, e.task_id))).length + s.milestones.filter(m => m.status === 'pending' && m.target_on && m.target_on < today).length,
    completed_count: tasks.filter(t => t.lifecycle === 'completed').length };
}
function consequences(s, id, people, today) {
  const next = structuredClone(s), hub = task(next, id); hub.lifecycle = 'completed';
  if (hub.kind === 'decision') next.outcomes.push({ task_id: id, cycle: hub.cycle, outcome: 'approve' });
  reconcile(next);
  return s.dependencies.filter(e => e.from_id === id && e.state === 'active').map(e => {
    const before = summary(s, task(s, e.to_id), people, today), after = summary(next, task(next, e.to_id), people, today);
    return { task_id: e.to_id, before: before.state, after: after.state, reasons: after.reasons, newly_ready: before.state !== 'ready' && after.state === 'ready' };
  });
}
function validateGraph(s) {
  const seen = new Set(), done = new Set(), pairs = new Set(), adjacency = new Map();
  for (const e of s.dependencies.filter(e => e.state !== 'removed')) {
    task(s, e.from_id); task(s, e.to_id);
    const pair = `${e.from_id}:${e.to_id}`;
    if (pairs.has(pair) || e.from_id === e.to_id) fail('Duplicate or self dependency', 409);
    pairs.add(pair); if (!adjacency.has(e.from_id)) adjacency.set(e.from_id, []); adjacency.get(e.from_id).push(e.to_id);
  }
  function visit(id) { if (seen.has(id)) fail('Dependencies cannot contain a cycle', 409); if (done.has(id)) return; seen.add(id); for (const n of adjacency.get(id) || []) visit(n); seen.delete(id); done.add(id); }
  for (const t of s.tasks) visit(t.id);
}
function reconcile(s) {
  if (s.lifecycle === 'cancelled') return;
  for (const e of s.dependencies) {
    const successor = task(s, e.to_id), invalid = !satisfied(s, e), progressed = ['in_progress', 'completed'].includes(successor.lifecycle);
    const existing = s.exceptions.find(x => x.edge_id === e.id && x.state === 'open');
    if (invalid && progressed && !existing) s.exceptions.push({ id: randomUUID(), edge_id: e.id, task_id: e.to_id, state: 'open', triggering_revision: s.revision + 1 });
    if (existing && (!invalid || !progressed)) { existing.state = 'resolved'; existing.resolved_revision = s.revision + 1; }
  }
  for (const m of s.milestones) if (m.status === 'achieved' && m.contributions.some(c => c.state === 'required' && task(s,c.task_id).lifecycle !== 'completed')) { m.status = 'pending'; m.review_reason = 'A contributing task changed after achievement'; }
}
function mutate(original, command, env) {
  const s = structuredClone(original), { type, data: b = {} } = command, { people, actor, lead, staffId, today } = env;
  const leadCommands = ['instance.update','instance.activate','instance.close','instance.cancel','instance.reopen','phase.add','task.add','task.update','task.reopen','task.cancel','task.reinstate','dependency.add','dependency.waive','dependency.remove','dependency.reinstate','milestone.add','milestone.achieve','milestone.cancel','milestone.reopen','milestone.waive'];
  if (leadCommands.includes(type) && !lead) fail('Only the Work Instance lead or Execution manager can perform this action', 403);
  if (s.lifecycle === 'cancelled' || (s.lifecycle === 'completed' && type !== 'instance.reopen')) fail('This Work Instance is closed', 409);
  const reason = () => text(b.reason, 'Reason', true);
  const activePerson = id => { if (id != null && !people.some(p => p.id === id && p.active)) fail('Choose an active staff member'); return id || null; };
  const owned = () => { const t = task(s, b.task_id); if (!lead && (t.assignee_staff_id !== staffId || !people.some(p => p.id === staffId && p.active))) fail('Only the assigned person or Execution lead can act', 403); return t; };
  const eligible = t => { if (!summary(s, t, people, today).actionable) fail('Task is not actionable: resolve prerequisites, blockers, availability and assignment first', 409); };
  const stamp = value => ({ ...value, id: randomUUID(), actor, at: new Date().toISOString() });
  const reopen = t => { t.lifecycle = 'open'; t.cycle += 1; t.completed_at = null; t.completed_by = null; };
  switch (type) {
    case 'instance.update': {
      for (const k of ['title', 'description', 'retrospective']) if (k in b) s[k] = text(b[k], k, k === 'title');
      if ('lead_staff_id' in b) s.lead_staff_id = activePerson(b.lead_staff_id);
      if ('academic_year_id' in b) s.academic_year_id = b.academic_year_id;
      if ('target_on' in b) s.target_on = date(b.target_on);
      if ('timezone' in b) { localDate(b.timezone); s.timezone = b.timezone; }
      break;
    }
    case 'instance.activate': if (s.lifecycle !== 'planning') fail('Only planning work can activate', 409); if (!s.lead_staff_id) fail('Assign a lead first'); activePerson(s.lead_staff_id); s.lifecycle = 'active'; s.activated_at = new Date().toISOString(); break;
    case 'instance.close': if (s.lifecycle !== 'active' || s.tasks.some(t => !terminal(t)) || s.blockers.some(x => x.state === 'open') || s.exceptions.some(x => x.state === 'open') || s.milestones.some(m => m.status === 'pending')) fail('Resolve unfinished tasks, blockers, exceptions and milestones before closing', 409); s.lifecycle = 'completed'; s.closed_at = new Date().toISOString(); break;
    case 'instance.reopen': if (s.lifecycle !== 'completed') fail('Only completed work can reopen', 409); reason(); s.lifecycle = 'active'; break;
    case 'instance.cancel': reason(); s.lifecycle = 'cancelled'; for (const t of s.tasks) if (!terminal(t)) t.lifecycle = 'cancelled'; for (const x of [...s.blockers, ...s.exceptions]) if (x.state === 'open') { x.state = 'resolved'; x.resolution = 'instance_cancelled'; } for (const m of s.milestones) if (m.status === 'pending') m.status = 'cancelled'; break;
    case 'phase.add': s.phases.push(stamp({ title: text(b.title, 'Phase title', true) })); break;
    case 'task.add':
    case 'task.update': {
      const t = type === 'task.add' ? { id: randomUUID(), lifecycle: 'open', cycle: 1, kind: 'ordinary', title: '', description: '', assignee_staff_id: null, responsible_role: '', phase_id: null, available_on: null, due_on: null, required_evidence: false, created_during_execution: s.lifecycle === 'active' } : task(s, b.task_id);
      if (terminal(t)) fail('Reopen before editing a terminal task', 409);
      for (const k of ['title','description','responsible_role']) if (k in b) t[k] = text(b[k], k, k === 'title');
      if (!t.title) fail('Task title required');
      if ('assignee_staff_id' in b) { t.assignee_staff_id = activePerson(b.assignee_staff_id); t.assignee_name = people.find(p => p.id === t.assignee_staff_id)?.name || null; }
      if ('kind' in b) { if (!['ordinary','decision'].includes(b.kind) || (t.lifecycle !== 'open' && b.kind !== t.kind)) fail('Task kind can only be changed on open tasks'); t.kind = b.kind; }
      if ('phase_id' in b) { if (b.phase_id && !s.phases.some(p => p.id === b.phase_id)) fail('Phase belongs to another instance'); t.phase_id = b.phase_id || null; }
      for (const k of ['available_on','due_on']) if (k in b) t[k] = date(b[k]);
      if (t.available_on && t.due_on && t.available_on > t.due_on) fail('Due date cannot precede availability');
      if ('required_evidence' in b) { if (typeof b.required_evidence !== 'boolean') fail('Evidence requirement must be boolean'); t.required_evidence = b.required_evidence; }
      if (type === 'task.add') s.tasks.push(t); break;
    }
    case 'task.start': { const t = owned(); eligible(t); if (t.kind === 'decision' || t.lifecycle !== 'open') fail('Only an open ordinary task can start',409); t.lifecycle = 'in_progress'; break; }
    case 'task.complete':
    case 'decision.approve': { const t = owned(); eligible(t); if ((type === 'decision.approve') !== (t.kind === 'decision')) fail('Decision tasks require an explicit approval',409); if (t.required_evidence && !s.links.some(l => l.task_id === t.id && l.kind === 'evidence')) fail('Add completion evidence first'); t.lifecycle = 'completed'; t.completed_at = new Date().toISOString(); t.completed_by = actor; if (t.kind === 'decision') s.outcomes.push(stamp({ task_id: t.id, cycle: t.cycle, outcome: 'approve', rationale: text(b.reason, 'Rationale') })); break; }
    case 'decision.return': { const t = owned(); eligible(t); if (t.kind !== 'decision') fail('Not a decision task'); reason(); if (!Array.isArray(b.revision_task_ids)) fail('Select revision deliverables');
      for (const id of new Set(b.revision_task_ids)) { if (!s.dependencies.some(e => e.from_id === id && e.to_id === t.id && e.state === 'active')) fail('Revision target must be a current prerequisite'); const p = task(s,id); if (p.lifecycle !== 'completed') fail('Revision target must be complete'); reopen(p); }
      s.outcomes.push(stamp({ task_id:t.id, cycle:t.cycle, outcome:'return_for_revision', rationale:b.reason, revision_task_ids:b.revision_task_ids })); t.cycle += 1;
      if (!b.revision_task_ids.length) s.blockers.push(stamp({ task_id:t.id, state:'open', reason:b.reason })); break; }
    case 'task.reopen': { const t = task(s,b.task_id); if (t.lifecycle !== 'completed') fail('Only completed tasks can reopen',409); reason(); reopen(t); break; }
    case 'task.reinstate': { const t = task(s,b.task_id); if (t.lifecycle !== 'cancelled') fail('Only cancelled tasks can reinstate',409); reason(); reopen(t); break; }
    case 'task.cancel': { const t = task(s,b.task_id); if (t.lifecycle === 'cancelled') fail('Task already cancelled',409); reason(); t.lifecycle='cancelled'; for (const x of s.blockers.filter(x=>x.task_id===t.id && x.state==='open')) { x.state='resolved'; x.resolution='task_cancelled'; } break; }
    case 'blocker.add': { const t=owned(); if (terminal(t)) fail('Terminal tasks cannot gain blockers'); s.blockers.push(stamp({task_id:t.id,reason:reason(),state:'open'})); break; }
    case 'blocker.resolve': { const t=owned(), x=s.blockers.find(x=>x.id===b.blocker_id&&x.task_id===t.id&&x.state==='open'); if (!x) fail('Open blocker not found'); x.state='resolved'; x.resolution=text(b.reason,'Resolution'); x.resolved_by=actor; x.resolved_at=new Date().toISOString(); break; }
    case 'dependency.add': task(s,b.from_id); task(s,b.to_id); s.dependencies.push(stamp({from_id:b.from_id,to_id:b.to_id,state:'active',rationale:text(b.reason,'Rationale')})); break;
    case 'dependency.waive':
    case 'dependency.remove':
    case 'dependency.reinstate': { const e=s.dependencies.find(e=>e.id===b.dependency_id); if(!e) fail('Dependency not found'); reason(); e.state=type==='dependency.waive'?'waived':type==='dependency.remove'?'removed':'active'; e.reason=b.reason; e.changed_by=actor; break; }
    case 'milestone.add': { if(!Array.isArray(b.task_ids)) fail('Milestone contributions must be a task list'); b.task_ids.forEach(id=>task(s,id)); s.milestones.push(stamp({title:text(b.title,'Milestone title',true),target_on:date(b.target_on),status:'pending',contributions:[...new Set(b.task_ids)].map(id=>({task_id:id,state:'required'}))})); break; }
    case 'milestone.achieve':
    case 'milestone.cancel':
    case 'milestone.reopen':
    case 'milestone.waive': { const m=s.milestones.find(m=>m.id===b.milestone_id); if(!m) fail('Milestone not found'); if(type==='milestone.waive'){reason();const c=m.contributions.find(c=>c.task_id===b.task_id);if(!c)fail('Contribution not found');c.state='waived';c.reason=b.reason;c.actor=actor;}
      else if(type==='milestone.achieve'){if(s.lifecycle!=='active'||m.status!=='pending'||m.contributions.some(c=>c.state==='required'&&task(s,c.task_id).lifecycle!=='completed'))fail('Required milestone work is incomplete',409);m.status='achieved';m.achieved_at=new Date().toISOString();m.achieved_by=actor;}
      else {reason();m.status=type==='milestone.cancel'?'cancelled':'pending';} break; }
    case 'link.add': { const t=owned(); if(!env.validatedLink)fail('Evidence or responsibility reference must be validated'); s.links.push(stamp({...env.validatedLink,task_id:t.id})); break; }
    default: fail('Unknown Execution command',400);
  }
  validateGraph(s); reconcile(s); s.revision += 1;
  return s;
}
module.exports={empty,mutate,project,summary,consequences,localDate,validateGraph,terminal,fail,text};
