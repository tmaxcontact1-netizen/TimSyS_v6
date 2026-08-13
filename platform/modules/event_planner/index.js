'use strict';
const appScope=require('../../shared/services/appScope');
const AREAS=[
 {key:'calendar',label:'Calendar',required:true,view:'calendar'},
 {key:'ownership',label:'Ownership',required:true,view:'ownership'},
 {key:'tasks',label:'Tasks',required:true,view:'tasks'},
 {key:'approvals',label:'Approvals',required:true,view:'approvals'},
 {key:'audience',label:'Audience',required:true,view:'audiences'},
 {key:'documents',label:'Documents',required:false,view:'documents'},
 {key:'communications',label:'Communications',required:false,view:'communications'},
 {key:'participation',label:'Invitations and attendance',required:false,view:'invitations'},
 {key:'venue',label:'Venue',required:false,view:'venue_bookings'},
 {key:'resources',label:'Resources',required:false,view:'resource_reservations'},
 {key:'transport',label:'Transportation',required:false,view:'transportation',types:['trip','sports']},
 {key:'catering',label:'Catering',required:false,view:'catering',types:['trip','performance','sports','conference','ceremony']},
 {key:'risk',label:'Risk assessment',required:false,view:'risk_assessments',types:['trip','performance','sports','conference','ceremony']},
 {key:'safeguarding',label:'Safeguarding',required:false,view:'safeguarding_requirements',types:['trip','performance','sports','conference','ceremony','wellbeing']},
 {key:'medical',label:'Medical referrals',required:false,view:'medical_referrals'},
 {key:'contingency',label:'Contingency',required:false,view:'contingency',types:['trip','performance','sports','conference','ceremony']},
 {key:'finance',label:'Finance',required:false,view:'financial_planning',types:['trip','performance','sports','conference','ceremony','recruitment']}
];
function boot(c){c.log.info('event_planner booting',{module:'event_planner'})}function teardown(){}
function bad(m){return{success:false,statusCode:404,error:{code:'NOT_FOUND',message:m}}}function scope(r){return appScope.fromRequest(r)}
function event(c,id,s){return c.db.query('SELECT * FROM event_records WHERE (id=? OR event_code=?) AND app_id=?',[id,id,s]).rows[0]}
function count(c,sql,p){return +c.db.query(sql,p).rows[0].n}
function linked(c,table,s,code,statusSql){return count(c,'SELECT COUNT(*) n FROM '+table+' WHERE app_id=? AND subject_component=? AND subject_type=? AND subject_id=?'+(statusSql||''),[s,'event_record','event',code])}
function evidence(c,e){const s=e.app_id,k=e.event_code,calendar=+!!e.calendar_entry_id||count(c,"SELECT COUNT(*) n FROM calendar_entries WHERE app_id=? AND source_component='event_record' AND source_record_id=?",[s,k]);return{
 calendar:{count:calendar,ready:calendar>0,detail:calendar?'Calendar entry linked':'Link an internal calendar entry'},
 ownership:{count:linked(c,'responsibilities',s,k," AND status IN ('active','delegated')"),detail:'Assign an active event owner'},
 tasks:{count:linked(c,'tasks',s,k),open:linked(c,'tasks',s,k," AND status NOT IN ('completed','withdrawn')")},
 approvals:{count:linked(c,'approval_requests',s,k),approved:linked(c,'approval_requests',s,k," AND status='approved'")},
 audience:{count:+!!e.audience_id,ready:!!e.audience_id,detail:e.audience_id?'Audience linked':'Link an audience'},
 documents:{count:count(c,"SELECT COUNT(*) n FROM document_links dl JOIN documents d ON d.id=dl.document_id WHERE d.app_id=? AND dl.subject_component='event_record' AND dl.subject_type='event' AND dl.subject_id=?",[s,k])},
 communications:{count:linked(c,'communications',s,k)},participation:{count:linked(c,'invitations',s,k)+linked(c,'attendance_sessions',s,k)},venue:{count:linked(c,'venue_bookings',s,k),confirmed:linked(c,'venue_bookings',s,k," AND status='confirmed'")},resources:{count:linked(c,'resource_reservations',s,k),confirmed:linked(c,'resource_reservations',s,k," AND status IN ('confirmed','issued','returned')")},transport:{count:linked(c,'transport_journeys',s,k),confirmed:linked(c,'transport_journeys',s,k," AND status IN ('confirmed','departed','arrived')")},catering:{count:linked(c,'catering_plans',s,k),confirmed:linked(c,'catering_plans',s,k," AND status IN ('confirmed','delivered')")},risk:{count:linked(c,'risk_assessments',s,k),approved:linked(c,'risk_assessments',s,k," AND status='approved'")},safeguarding:{count:linked(c,'safeguarding_requirements',s,k),open:linked(c,'safeguarding_requirements',s,k," AND status='open'")},medical:{count:linked(c,'medical_referrals',s,k),blocked:linked(c,'medical_referrals',s,k," AND operational_clearance IN ('pending','not_cleared')")},contingency:{count:linked(c,'contingency_plans',s,k),ready:linked(c,'contingency_plans',s,k," AND status IN ('ready','active','resolved')")},finance:{count:linked(c,'financial_budgets',s,k),approved:linked(c,'financial_budgets',s,k," AND status IN ('approved','closed')")}}}
function assess(e,x){return AREAS.map(a=>{let applicable=a.required||(a.types||[]).includes(e.event_type)||x[a.key].count>0,ready=true,detail='Not required for this event';if(applicable){let v=x[a.key];detail=v.count+' linked record'+(v.count===1?'':'s');if(a.key==='calendar'||a.key==='audience')ready=v.ready;else if(a.key==='ownership')ready=v.count>0;else if(a.key==='tasks')ready=v.count>0&&v.open===0;else if(a.key==='approvals')ready=v.count>0&&v.approved===v.count;else if(['venue','resources','transport','catering'].includes(a.key))ready=v.count>0&&v.confirmed===v.count;else if(a.key==='risk')ready=v.count>0&&v.approved===v.count;else if(a.key==='safeguarding')ready=v.count>0&&v.open===0;else if(a.key==='medical')ready=v.blocked===0;else if(a.key==='contingency')ready=v.count>0&&v.ready===v.count;else if(a.key==='finance')ready=v.count>0&&v.approved===v.count;else ready=true;if(!ready&&v.detail)detail=v.detail}return Object.assign({},a,{applicable,ready,status:!applicable?'not_required':ready?'ready':'attention',detail})})}
function compose(c,e){const areas=assess(e,evidence(c,e)),applicable=areas.filter(a=>a.applicable),ready=applicable.filter(a=>a.ready).length,blockers=applicable.filter(a=>!a.ready);return{event:e,readiness:{ready,applicable:applicable.length,percent:applicable.length?Math.round(ready/applicable.length*100):100,status:blockers.length?'attention':'ready',blockers:blockers.map(a=>({area:a.key,message:a.detail,view:a.view}))},areas}}
async function manifest(){return{success:true,module:{name:'event_planner',principle:'Composition without duplicated ownership',subjectContract:{component:'event_record',type:'event',id:'event_code'},areas:AREAS}}}
async function list(r,c){let s=scope(r),page=Math.max(1,+r.query.page||1),limit=Math.min(50,Math.max(1,+r.query.limit||50)),w=['app_id=?'],p=[s];if(r.query.q){w.push('(title LIKE ? OR event_code LIKE ?)');p.push('%'+r.query.q+'%','%'+r.query.q+'%')}if(r.query.status){w.push('status=?');p.push(r.query.status)}let clause=' WHERE '+w.join(' AND '),total=count(c,'SELECT COUNT(*) n FROM event_records'+clause,p),rows=c.db.query('SELECT * FROM event_records'+clause+' ORDER BY starts_at DESC,id DESC LIMIT ? OFFSET ?',p.concat([limit,(page-1)*limit])).rows;return{success:true,events:rows.map(e=>compose(c,e)),total,page,limit}}
async function workspace(r,c){let e=event(c,r.params.id,scope(r));return e?Object.assign({success:true},compose(c,e)):bad('Event not found')}
module.exports={boot,teardown,manifest,list,workspace};
