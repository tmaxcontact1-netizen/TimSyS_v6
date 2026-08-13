'use strict';

var appScope = require('../../shared/services/appScope');

var LAYERS = [
  ['leadership','Leadership and governance','#a855f7',1], ['academic','Academic programme','#2563eb',0],
  ['academic_management','Academic management and assessment','#3b82f6',0], ['wellbeing','Pastoral care and wellbeing','#14b8a6',1],
  ['safeguarding','Safeguarding and student support','#ef4444',1], ['sport','Sport and activities','#22c55e',0],
  ['arts','Arts and culture','#ec4899',0], ['admissions','Admissions and recruitment','#f59e0b',1],
  ['hr','HR and professional development','#8b5cf6',1], ['operations','Operations, facilities and resources','#64748b',0],
  ['finance','Finance and procurement','#84cc16',1], ['compliance','Compliance, health and safety','#f97316',1],
  ['communications','Communications and community','#06b6d4',0], ['technology','Technology, data and systems','#6366f1',1]
];

function json(value, fallback) { try { return JSON.parse(value); } catch (e) { return fallback; } }
function serial(value, fallback) { return JSON.stringify(value === undefined ? fallback : value); }
function scope(req) { return appScope.fromRequest(req); }
function role(req) {
  var permissions = (req.user && req.user.permissions) || [];
  if (permissions.includes('admin:*') || permissions.includes('*')) return 'superuser';
  if (permissions.some(function(p) { return p.indexOf('admin:principal') === 0; })) return 'principal';
  return (req.user && req.user.role) || 'staff';
}
function visible(row, req) {
  var allowed = json(row.visibility_roles, []);
  return row.created_by === String(req.user.id) || allowed.includes(role(req)) || allowed.includes('*');
}
function hydrate(row) {
  ['layer_codes','visibility_roles'].forEach(function(k) { row[k] = json(row[k], []); });
  row.recurrence = json(row.recurrence, null); row.all_day = Boolean(row.all_day); row.public_enabled = Boolean(row.public_enabled);
  return row;
}
function validDate(value) { return value && !isNaN(new Date(value).getTime()); }
function add(date, frequency, interval) {
  var next = new Date(date.getTime());
  if (frequency === 'daily') next.setUTCDate(next.getUTCDate() + interval);
  if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + (7 * interval));
  if (frequency === 'monthly') next.setUTCMonth(next.getUTCMonth() + interval);
  if (frequency === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + interval);
  return next;
}
function materialise(ctx, entry) {
  ctx.db.query('DELETE FROM calendar_instances WHERE entry_id = ?', [entry.id]);
  var start = new Date(entry.start_at), end = new Date(entry.end_at), duration = end.getTime() - start.getTime();
  var rule = json(entry.recurrence, null), horizon = new Date(); horizon.setUTCFullYear(horizon.getUTCFullYear() + 5);
  var count = 0, cursor = start;
  while (cursor <= horizon && count < 2000) {
    if (!rule || !rule.until || cursor <= new Date(rule.until)) {
      ctx.db.query('INSERT OR IGNORE INTO calendar_instances (entry_id,start_at,end_at) VALUES (?,?,?)', [entry.id, cursor.toISOString(), new Date(cursor.getTime() + duration).toISOString()]);
    }
    count++;
    if (!rule || !rule.frequency || (rule.count && count >= Number(rule.count))) break;
    cursor = add(cursor, rule.frequency, Math.max(1, Number(rule.interval) || 1));
  }
  var exceptions=ctx.db.query('SELECT * FROM calendar_exceptions WHERE entry_id=?',[entry.id]).rows;
  exceptions.forEach(function(exception){
    ctx.db.query('DELETE FROM calendar_instances WHERE entry_id=? AND start_at=?',[entry.id,exception.original_start_at]);
    if(exception.action==='rescheduled'&&exception.replacement_start_at&&exception.replacement_end_at)ctx.db.query('INSERT OR REPLACE INTO calendar_instances (entry_id,start_at,end_at,status) VALUES (?,?,?,?)',[entry.id,exception.replacement_start_at,exception.replacement_end_at,'rescheduled']);
  });
}
function validate(body) {
  if (!body.title || !body.primary_layer || !validDate(body.start_at) || !validDate(body.end_at)) return 'title, primary_layer, start_at and end_at are required';
  if (new Date(body.end_at) < new Date(body.start_at)) return 'end_at must not be before start_at';
  if (body.recurrence && !['daily','weekly','monthly','yearly'].includes(body.recurrence.frequency)) return 'Unsupported recurrence frequency';
  return null;
}
function period(value) { return typeof value === 'string' && /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(value); }
function audit(ctx, action, req, oldValue, newValue, id) { ctx.db.query('INSERT INTO audit_log (timestamp,user_id,action,entity_type,entity_id,old_value,new_value,ip_address) VALUES (?,?,?,?,?,?,?,?)',[Date.now(),String(req.user.id),action,'calendar_entry',String(id),oldValue?JSON.stringify(oldValue):null,newValue?JSON.stringify(newValue):null,null]); }
function boot(ctx) {
  LAYERS.forEach(function(item, i) { ctx.db.query('INSERT OR IGNORE INTO calendar_layers (app_id,code,name,colour,sensitive,sort_order) VALUES (?,?,?,?,?,?)', ['principal-ed',item[0],item[1],item[2],item[3],i]); });
  ctx.db.query("INSERT OR IGNORE INTO calendar_settings (app_id) VALUES ('principal-ed')");
  ctx.log.info('calendar booting', { module: 'calendar' });
}
function teardown() {}
async function getSettings(req, ctx) { var s = scope(req); var row = ctx.db.query('SELECT * FROM calendar_settings WHERE app_id = ?', [s]).rows[0]; return {success:true,settings:row}; }
async function updateSettings(req, ctx) {
  var s=scope(req), b=req.body||{};
  if (![b.calendar_start,b.calendar_end,b.academic_start,b.academic_end].every(period)) return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:'Calendar and academic periods must use valid MM-DD dates'}};
  ctx.db.query("INSERT INTO calendar_settings (app_id,calendar_system,locale,timezone,academic_start_month,academic_start_day,academic_year_label,calendar_start,calendar_end,academic_start,academic_end) VALUES (?,'gregorian',?,?,?,?,?,?,?,?,?) ON CONFLICT(app_id) DO UPDATE SET calendar_system='gregorian',locale=excluded.locale,timezone=excluded.timezone,academic_start_month=excluded.academic_start_month,academic_start_day=excluded.academic_start_day,academic_year_label=excluded.academic_year_label,calendar_start=excluded.calendar_start,calendar_end=excluded.calendar_end,academic_start=excluded.academic_start,academic_end=excluded.academic_end,updated_at=datetime('now')", [s,b.locale||'en-GB',b.timezone||'UTC',Number(b.academic_start.slice(0,2)),Number(b.academic_start.slice(3,5)),b.academic_year_label||null,b.calendar_start,b.calendar_end,b.academic_start,b.academic_end]);
  return getSettings(req,ctx);
}
async function listLayers(req,ctx) { return {success:true,layers:ctx.db.query('SELECT * FROM calendar_layers WHERE app_id = ? ORDER BY sort_order,name',[scope(req)]).rows}; }
async function listEntries(req,ctx) {
  var s=scope(req), from=req.query.from||new Date(0).toISOString(), to=req.query.to||'9999-12-31T23:59:59.999Z';
  var conditions=['e.app_id=?','i.start_at<=?','i.end_at>=?'],params=[s,to,from];
  if(req.query.layer){conditions.push('(e.primary_layer=? OR e.layer_codes LIKE ?)');params.push(req.query.layer,'%"'+req.query.layer+'"%');}
  if(req.query.status){conditions.push('e.status=?');params.push(req.query.status);}
  if(req.query.source_component){conditions.push('e.source_component=?');params.push(req.query.source_component);}
  params.push(1000);
  var rows=ctx.db.query('SELECT e.*, e.start_at AS series_start_at, e.end_at AS series_end_at, i.id AS instance_id, i.start_at AS instance_start_at, i.end_at AS instance_end_at, i.status AS instance_status FROM calendar_entries e JOIN calendar_instances i ON i.entry_id=e.id WHERE '+conditions.join(' AND ')+' ORDER BY i.start_at LIMIT ?',params).rows.filter(function(r){return visible(r,req);}).map(function(row){ row.start_at=row.instance_start_at; row.end_at=row.instance_end_at; return hydrate(row); });
  return {success:true,entries:rows,total:rows.length};
}
async function createEntry(req,ctx) {
  var b=req.body||{}, error=validate(b); if(error)return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:error}};
  var s=scope(req), values=[s,b.title,b.description||null,b.primary_layer,serial(b.layer_codes,[b.primary_layer]),new Date(b.start_at).toISOString(),new Date(b.end_at).toISOString(),b.all_day?1:0,b.status||'planned',b.priority||'normal',serial(b.visibility_roles,['superuser','principal']),b.recurrence?serial(b.recurrence,null):null,b.rollover_strategy||'manual_review',b.source_component||null,b.source_record_id||null,b.source_type||null,String(req.user.id)];
  var result=ctx.db.query('INSERT INTO calendar_entries (app_id,title,description,primary_layer,layer_codes,start_at,end_at,all_day,status,priority,visibility_roles,recurrence,rollover_strategy,source_component,source_record_id,source_type,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',values);
  var entry=ctx.db.query('SELECT * FROM calendar_entries WHERE id=?',[result.lastInsertRowid]).rows[0]; materialise(ctx,entry); audit(ctx,'calendar.entry.create',req,null,entry,entry.id); ctx.events.publish('calendar.entry.created',{entityType:'calendar_entry',entityId:entry.id,record:entry,actorId:req.user.id,__module:'calendar'}); return {success:true,entry:hydrate(entry)};
}
async function updateEntry(req,ctx) {
  var existing=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0]; if(!existing||!visible(existing,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};
  var b=Object.assign({},hydrate(existing),req.body||{}), error=validate(b); if(error)return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:error}};
  ctx.db.query("UPDATE calendar_entries SET title=?,description=?,primary_layer=?,layer_codes=?,start_at=?,end_at=?,all_day=?,status=?,priority=?,visibility_roles=?,recurrence=?,rollover_strategy=?,updated_at=datetime('now') WHERE id=?",[b.title,b.description||null,b.primary_layer,serial(b.layer_codes,[b.primary_layer]),new Date(b.start_at).toISOString(),new Date(b.end_at).toISOString(),b.all_day?1:0,b.status,b.priority,serial(b.visibility_roles,[]),b.recurrence?serial(b.recurrence,null):null,b.rollover_strategy,existing.id]);
  var updated=ctx.db.query('SELECT * FROM calendar_entries WHERE id=?',[existing.id]).rows[0]; materialise(ctx,updated); audit(ctx,'calendar.entry.update',req,existing,updated,existing.id); ctx.events.publish('calendar.entry.updated',{entityType:'calendar_entry',entityId:existing.id,record:updated,actorId:req.user.id,__module:'calendar'}); return {success:true,entry:hydrate(updated)};
}
async function deleteEntry(req,ctx){var row=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0];if(!row||!visible(row,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};ctx.db.query('DELETE FROM calendar_entries WHERE id=?',[row.id]);audit(ctx,'calendar.entry.delete',req,row,null,row.id);return {success:true,deleted:true};}
async function setStatus(req,ctx){var row=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0],next=req.body&&req.body.status;if(!row||!visible(row,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};if(!['draft','planned','confirmed','completed','cancelled'].includes(next))return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:'Invalid calendar-entry status'}};ctx.db.query("UPDATE calendar_entries SET status=?,updated_at=datetime('now') WHERE id=?",[next,row.id]);var updated=ctx.db.query('SELECT * FROM calendar_entries WHERE id=?',[row.id]).rows[0];audit(ctx,'calendar.entry.status',req,row,updated,row.id);ctx.events.publish('calendar.entry.status_changed',{entityId:row.id,oldStatus:row.status,status:next,__module:'calendar'});return {success:true,entry:hydrate(updated)};}
async function setException(req,ctx){var row=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0],b=req.body||{};if(!row||!visible(row,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};if(!validDate(b.original_start_at)||!['cancelled','rescheduled'].includes(b.action)||(b.action==='rescheduled'&&(!validDate(b.replacement_start_at)||!validDate(b.replacement_end_at))))return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:'A valid occurrence, action and replacement dates are required'}};ctx.db.query('INSERT INTO calendar_exceptions (entry_id,original_start_at,action,replacement_start_at,replacement_end_at,reason,created_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(entry_id,original_start_at) DO UPDATE SET action=excluded.action,replacement_start_at=excluded.replacement_start_at,replacement_end_at=excluded.replacement_end_at,reason=excluded.reason',[row.id,new Date(b.original_start_at).toISOString(),b.action,b.replacement_start_at?new Date(b.replacement_start_at).toISOString():null,b.replacement_end_at?new Date(b.replacement_end_at).toISOString():null,b.reason||null,String(req.user.id)]);materialise(ctx,row);audit(ctx,'calendar.entry.exception',req,null,b,row.id);ctx.events.publish('calendar.entry.exception_set',{entityId:row.id,exception:b,__module:'calendar'});return {success:true,exception:true};}
async function getAudit(req,ctx){var row=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0];if(!row||!visible(row,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};return {success:true,audit:ctx.db.query('SELECT * FROM audit_log WHERE entity_type=? AND entity_id=? ORDER BY timestamp DESC LIMIT 100',['calendar_entry',String(row.id)]).rows};}
async function publishEntry(req,ctx){var row=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0];if(!row||!visible(row,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};var b=req.body||{};ctx.db.query("UPDATE calendar_entries SET public_enabled=1,public_status='published',public_title=?,public_description=?,public_start_at=?,public_end_at=?,updated_at=datetime('now') WHERE id=?",[b.public_title||row.title,b.public_description||row.description,b.public_start_at||row.start_at,b.public_end_at||row.end_at,row.id]);var updated=ctx.db.query('SELECT * FROM calendar_entries WHERE id=?',[row.id]).rows[0];audit(ctx,'calendar.entry.publish',req,row,updated,row.id);ctx.events.publish('calendar.entry.published',{entityId:row.id,__module:'calendar'});return {success:true,published:true};}
async function withdrawPublication(req,ctx){var row=ctx.db.query('SELECT * FROM calendar_entries WHERE id=? AND app_id=?',[req.params.id,scope(req)]).rows[0];if(!row||!visible(row,req))return {success:false,statusCode:404,error:{code:'NOT_FOUND',message:'Calendar entry not found'}};ctx.db.query("UPDATE calendar_entries SET public_enabled=0,public_status='withdrawn',updated_at=datetime('now') WHERE id=?",[row.id]);audit(ctx,'calendar.entry.publication_withdraw',req,row,null,row.id);ctx.events.publish('calendar.entry.publication_withdrawn',{entityId:row.id,__module:'calendar'});return {success:true,withdrawn:true};}
async function findConflicts(req,ctx){var from=req.query.from,to=req.query.to,s=scope(req);if(!validDate(from)||!validDate(to))return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:'Valid from and to dates are required'}};var params=[s,new Date(to).toISOString(),new Date(from).toISOString()],extra='';if(req.query.exclude_entry_id){extra=' AND e.id != ?';params.push(req.query.exclude_entry_id);}var rows=ctx.db.query("SELECT e.id,e.title,e.primary_layer,e.status,e.visibility_roles,e.created_by,i.start_at,i.end_at FROM calendar_entries e JOIN calendar_instances i ON i.entry_id=e.id WHERE e.app_id=? AND e.status NOT IN ('cancelled','completed') AND i.start_at<? AND i.end_at>?"+extra+' ORDER BY i.start_at LIMIT 100',params).rows.filter(function(row){return visible(row,req);}).map(function(row){delete row.visibility_roles;delete row.created_by;return row;});return {success:true,conflicts:rows,total:rows.length};}
async function publicCalendar(req,ctx){var s=(req.query&&req.query.app_id)||'principal-ed';if(s!=='principal-ed')return {success:false,statusCode:400,error:{code:'INVALID_APP_SCOPE',message:'Invalid application scope'}};var rows=ctx.db.query("SELECT e.id,i.id AS instance_id,e.public_title AS title,e.public_description AS description,CASE WHEN e.recurrence IS NULL THEN e.public_start_at ELSE i.start_at END AS start_at,CASE WHEN e.recurrence IS NULL THEN e.public_end_at ELSE i.end_at END AS end_at,e.all_day FROM calendar_entries e JOIN calendar_instances i ON i.entry_id=e.id WHERE e.app_id=? AND e.public_enabled=1 AND e.public_status='published' ORDER BY start_at LIMIT 500",[s]).rows;return {success:true,entries:rows};}
async function rollover(req,ctx){var b=req.body||{}, year=Number(b.target_year);if(!year||year<2000||year>2200)return {success:false,statusCode:400,error:{code:'VALIDATION_ERROR',message:'target_year is required'}};var rows=ctx.db.query('SELECT * FROM calendar_entries WHERE app_id=? AND status != ?',[scope(req),'cancelled']).rows,created=[];rows.forEach(function(row){if(row.rollover_strategy==='none'||row.parent_entry_id)return;var start=new Date(row.start_at),end=new Date(row.end_at),delta=year-start.getUTCFullYear();start.setUTCFullYear(start.getUTCFullYear()+delta);end.setUTCFullYear(end.getUTCFullYear()+delta);if(ctx.db.query('SELECT id FROM calendar_entries WHERE parent_entry_id=? AND start_at=?',[row.id,start.toISOString()]).rows.length)return;var result=ctx.db.query("INSERT INTO calendar_entries (app_id,title,description,primary_layer,layer_codes,start_at,end_at,all_day,status,priority,visibility_roles,recurrence,rollover_strategy,parent_entry_id,source_component,source_record_id,source_type,created_by,public_enabled,public_status) SELECT app_id,title,description,primary_layer,layer_codes,?,?,all_day,'draft',priority,visibility_roles,recurrence,rollover_strategy,id,source_component,source_record_id,source_type,?,0,'draft' FROM calendar_entries WHERE id=?",[start.toISOString(),end.toISOString(),String(req.user.id),row.id]);var copy=ctx.db.query('SELECT * FROM calendar_entries WHERE id=?',[result.lastInsertRowid]).rows[0];materialise(ctx,copy);audit(ctx,'calendar.entry.rollover',req,row,copy,copy.id);ctx.events.publish('calendar.entry.rolled_over',{entityId:copy.id,parentEntryId:row.id,__module:'calendar'});created.push(hydrate(copy));});return {success:true,created:created,total:created.length,draft:true};}

module.exports={boot:boot,teardown:teardown,getSettings:getSettings,updateSettings:updateSettings,listLayers:listLayers,listEntries:listEntries,createEntry:createEntry,updateEntry:updateEntry,deleteEntry:deleteEntry,setStatus:setStatus,setException:setException,getAudit:getAudit,publishEntry:publishEntry,withdrawPublication:withdrawPublication,findConflicts:findConflicts,rollover:rollover,publicCalendar:publicCalendar};
