'use strict';
const DEFAULTS = {
  read: ['staff','teacher','reception','secretary','medical','counsellor','safeguarding','admin','principal','superuser'], request: ['staff','teacher','reception','secretary','admin','principal','superuser'],
  release: ['teacher','reception','secretary','admin','principal','superuser'], receive: ['staff','teacher','reception','secretary','admin','principal','superuser'],
  return: ['staff','teacher','reception','secretary','admin','principal','superuser'], check_in: ['staff','teacher','reception','secretary','admin','principal','superuser'],
  approve: ['admin','principal','superuser'], cancel: ['teacher','reception','secretary','admin','principal','superuser'],
  campus_authorise: ['reception','secretary','admin','principal','superuser'], campus_release: ['reception','secretary','admin','principal','superuser'],
  restricted_view: ['counsellor','medical','safeguarding','principal','superuser'], configure: ['principal','superuser']
};
function permissions(r) { return r && r.user && Array.isArray(r.user.permissions) ? r.user.permissions : []; }
function privileged(r) { const p = permissions(r); return p.includes('*') || p.includes('admin:*'); }
function role(r) { const p = permissions(r); if (privileged(r) || p.some(x => x === 'admin:superuser' || x.startsWith('admin:superuser:'))) return 'superuser'; if (p.some(x => x === 'admin:principal' || x.startsWith('admin:principal:'))) return 'principal'; return String((r.user && r.user.role) || 'staff').toLowerCase(); }
function policy(c, appId) { const rows = c.db.query('SELECT action,roles_json FROM student_exit_action_policy WHERE app_id=? AND enabled=1', [appId]).rows, result = Object.assign({}, DEFAULTS); rows.forEach(row => { try { result[row.action] = JSON.parse(row.roles_json); } catch (_) {} }); return result; }
function can(r, c, appId, action) { if (privileged(r)) return true; const allowed = policy(c, appId)[action] || []; return allowed.includes(role(r)); }
function requireAction(r, c, appId, action) { return can(r, c, appId, action) ? null : { success:false,statusCode:403,error:{code:'STUDENT_EXIT_ACTION_DENIED',message:`The ${action} action is not permitted for this role`}}; }
module.exports = { DEFAULTS, permissions, privileged, role, policy, can, requireAction };
