'use strict';
function permissions(req){return req&&req.user&&Array.isArray(req.user.permissions)?req.user.permissions:[]}
function privileged(req){const p=permissions(req);return p.includes('*')||p.includes('admin:*')||p.some(x=>x==='admin:principal'||x==='admin:superuser'||x.startsWith('admin:principal:')||x.startsWith('admin:superuser:'))}
function assigned(ctx,gradebook,userId){if(!gradebook||!userId)return false;return!!ctx.db.query("SELECT id FROM teaching_group_teachers WHERE teaching_group_id=? AND staff_id=? AND status='active'",[gradebook.teaching_group_id,String(userId)]).rows[0]}
function canUse(req,ctx,gradebook){return privileged(req)||assigned(ctx,gradebook,req.user&&req.user.id)}
function requireUse(req,ctx,gradebook){return canUse(req,ctx,gradebook)?null:{success:false,statusCode:403,error:{code:'GRADEBOOK_ACCESS_DENIED',message:'Access is limited to assigned teachers, principals and superusers'}}}
function requireGovernor(req){return privileged(req)?null:{success:false,statusCode:403,error:{code:'GRADEBOOK_GOVERNANCE_DENIED',message:'Gradebook configuration requires principal or superuser access'}}}
module.exports={privileged,assigned,canUse,requireUse,requireGovernor};
