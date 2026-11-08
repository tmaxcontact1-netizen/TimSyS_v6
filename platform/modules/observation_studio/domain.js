'use strict';
// Ported domain rules from the user-supplied Observation Studio. No Google services.
module.exports=function domain(bindings){
const {settings,readStore,writeStore,teachers,access,readVisit,visitRows,validateSchedule,validatePD,candidateAvailable}=bindings;
const Utilities={getUuid:()=>require('crypto').randomUUID(),formatDate:(d,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
// The platform owns the outer transaction and serialises this module's writes.
const LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})};
const studioAccess_=()=>({users:access});
const studioTemplates_=()=>readStore('templates',STUDIO_TEMPLATE_DEFAULTS);
const studioTeacher_=id=>{const t=teachers.find(t=>t.id===id&&!t.archived);if(!t)throw Error('Choose an active staff profile.');return t};
const studioReadRecord_=id=>readVisit(id);
const scheduleRows_=()=>visitRows();
const scheduleStore_=()=>readStore('schedule',{revision:0,entries:[]});
const scheduleSave_=s=>{validateSchedule(s);s.revision++;writeStore('schedule',s)};
const pdevStore_=()=>readStore('pd',{revision:0,sessions:[]});
const pdevTeachers_=()=>teachers;
const pdevSave_=s=>{validatePD(s);s.revision++;writeStore('pd',s)};
const pdevView_=s=>({...s,sessions:s.sessions.filter(x=>!x.deleted),removedSessions:s.sessions.filter(x=>x.deleted)});
var STUDIO_TEMPLATE_DEFAULTS={
  "probation": {
    "revision": 1,
    "academicYear": "",
    "schema": {
      "title": "Probation review",
      "subtitle": "",
      "year": "",
      "introduction": "",
      "purpose": "",
      "levels": [
        "Beginning",
        "Developing",
        "Proficient",
        "Exemplary"
      ],
      "reviewPurposes": [
        "Month 1 Check-in",
        "Month 2 Check-in",
        "Final Probation Review (Month 3)"
      ],
      "recommendations": [
        "Confirm employment — probation successfully completed",
        "Extend probation period (specify duration below)",
        "Do not confirm employment",
        "Continue probation — proceed to Observation 2",
        "Continue probation — proceed to Observation 3"
      ],
      "domains": [
        {
          "id": "domain1",
          "title": "Learning Intentions & Success Criteria",
          "descriptors": [
            "Learning target unclear or absent.",
            "Learning target communicated; some students understand the goal.",
            "Learning targets and success criteria guide learning; most students can explain them.",
            "Students independently use learning targets and success criteria to monitor progress."
          ]
        },
        {
          "id": "domain2",
          "title": "Classroom Culture & Relationships",
          "descriptors": [
            "Student voice limited; relationships are not consistently evident.",
            "Positive relationships evident; participation occurs when prompted.",
            "Students feel safe, respected, and valued.",
            "Students contribute to a culture of trust, belonging, and academic risk-taking."
          ]
        },
        {
          "id": "domain3",
          "title": "Classroom Management & Learning Environment",
          "descriptors": [
            "Expectations and routines are inconsistent.",
            "Routines are established but inconsistently followed.",
            "Clear routines maximize learning time.",
            "Students independently manage routines and transitions."
          ]
        },
        {
          "id": "domain4",
          "title": "Instructional Design & Engagement",
          "descriptors": [
            "Activities focus primarily on task completion.",
            "Activities align with goals and engage many students.",
            "Learning experiences are purposeful, engaging, and aligned.",
            "Students drive learning through inquiry and authentic application."
          ]
        },
        {
          "id": "domain5",
          "title": "Cooperative Learning & Student Discourse",
          "descriptors": [
            "Student talk is limited.",
            "Structured discussion opportunities exist.",
            "Cooperative structures promote meaningful discourse.",
            "Students independently engage in rich academic discourse."
          ]
        },
        {
          "id": "domain6",
          "title": "Questioning & Higher-Order Thinking",
          "descriptors": [
            "Questions focus on recall.",
            "Some questions require analysis or reasoning.",
            "Questions challenge students to analyze, evaluate, and justify.",
            "Students generate questions and engage in deep thinking."
          ]
        },
        {
          "id": "domain7",
          "title": "Formative Assessment & Feedback",
          "descriptors": [
            "Limited checks for understanding.",
            "Assessment informs some instructional decisions.",
            "Frequent formative assessment guides instruction.",
            "Students use self and peer assessment to improve learning."
          ]
        },
        {
          "id": "domain8",
          "title": "Differentiation & Learner Access",
          "descriptors": [
            "Instruction is largely one-size-fits-all.",
            "Some adjustments are evident.",
            "Instruction is intentionally differentiated.",
            "Personalized pathways maximize growth and independence."
          ]
        },
        {
          "id": "domain9",
          "title": "Student Ownership & Agency",
          "descriptors": [
            "Students rely heavily on teacher direction.",
            "Students demonstrate some independence.",
            "Students monitor progress and reflect on growth.",
            "Students set goals and demonstrate strong self-direction."
          ]
        }
      ],
      "acknowledgements": [
        "Reviewer",
        "School representative",
        "Teacher"
      ],
      "confidentiality": ""
    }
  },
  "tbo": {
    "revision": 1,
    "academicYear": "",
    "wording": {}
  }
};

function studioTemplateRpc_(body,user){
 const lock=LockService.getScriptLock();if(body&&!lock.tryLock(10000))throw Error('Another template is saving. Try again.');
 try{
  const templates=studioTemplates_(),canManage=studioAccess_().users.some(u=>u.email===user&&u.role==='administrator');
  if(!body)return {ok:true,data:{templates,canManage}};
  if(!canManage)throw Error('Only administrators can edit templates.');
  const protocol=body.protocol;if(!['tbo','probation'].includes(protocol))throw Error('Choose a template.');
  if(body.baseRevision!==templates[protocol].revision)return {ok:false,error:'This template was updated by another administrator. Reopen Templates before saving.',conflict:true};
  const value=body.value,short=s=>typeof s==='string'&&s.trim().length>0&&s.length<=20000;
  if(!value||typeof value.academicYear!=='string'||value.academicYear.length>80)throw Error('Academic year must be text up to 80 characters; leave it blank until configured.');
  let next={revision:templates[protocol].revision+1,academicYear:value.academicYear,updatedAt:Date.now(),updatedBy:user};
  if(protocol==='tbo'){
   if(!value.wording||Array.isArray(value.wording)||typeof value.wording!=='object'||Object.keys(value.wording).length>500)throw Error('Invalid template wording.');
   if(Object.entries(value.wording).some(([k,v])=>!short(k)||!short(v)||k.length>2000||v.length>4000))throw Error('Enter text for each wording item.');
   next.wording=value.wording;
  }else{
   const s=value.schema,base=STUDIO_TEMPLATE_DEFAULTS.probation.schema;
   if(!s||!short(s.title)||['subtitle','introduction','purpose','confidentiality'].some(k=>typeof s[k]!=='string'||s[k].length>20000))throw Error('Enter a title; optional template text may remain blank.');
   if(JSON.stringify(s.levels)!==JSON.stringify(base.levels))throw Error('Rating levels must retain their original data values.');
   if(!Array.isArray(s.domains)||s.domains.length!==base.domains.length||s.domains.some((d,i)=>d.id!==base.domains[i].id||!short(d.title)||!Array.isArray(d.descriptors)||d.descriptors.length!==4||d.descriptors.some(v=>!short(v))))throw Error('Complete every domain title and descriptor.');
   for(const k of ['reviewPurposes','recommendations','acknowledgements'])if(!Array.isArray(s[k])||s[k].length!==base[k].length||s[k].some(v=>!short(v))||new Set(s[k]).size!==s[k].length)throw Error('Complete each '+k+' option with unique text.');
   next.schema={...base,...Object.fromEntries(['title','subtitle','introduction','purpose','confidentiality','domains','reviewPurposes','recommendations','acknowledgements'].map(k=>[k,s[k]])),year:value.academicYear};
  }
  templates[protocol]=next;const text=JSON.stringify(templates);if(text.length>200000)throw Error('Template text is too large.');
  writeStore('templates',templates);return {ok:true,data:{templates,canManage:true}};
 }finally{if(body)lock.releaseLock();}
}

var PROBATION_SCHEMA={
  "title": "Probation review",
  "subtitle": "",
  "year": "",
  "introduction": "",
  "purpose": "",
  "levels": [
    "Beginning",
    "Developing",
    "Proficient",
    "Exemplary"
  ],
  "reviewPurposes": [
    "Month 1 Check-in",
    "Month 2 Check-in",
    "Final Probation Review (Month 3)"
  ],
  "recommendations": [
    "Confirm employment — probation successfully completed",
    "Extend probation period (specify duration below)",
    "Do not confirm employment",
    "Continue probation — proceed to Observation 2",
    "Continue probation — proceed to Observation 3"
  ],
  "domains": [
    {
      "id": "domain1",
      "title": "Learning Intentions & Success Criteria",
      "descriptors": [
        "Learning target unclear or absent.",
        "Learning target communicated; some students understand the goal.",
        "Learning targets and success criteria guide learning; most students can explain them.",
        "Students independently use learning targets and success criteria to monitor progress."
      ]
    },
    {
      "id": "domain2",
      "title": "Classroom Culture & Relationships",
      "descriptors": [
        "Student voice limited; relationships are not consistently evident.",
        "Positive relationships evident; participation occurs when prompted.",
        "Students feel safe, respected, and valued.",
        "Students contribute to a culture of trust, belonging, and academic risk-taking."
      ]
    },
    {
      "id": "domain3",
      "title": "Classroom Management & Learning Environment",
      "descriptors": [
        "Expectations and routines are inconsistent.",
        "Routines are established but inconsistently followed.",
        "Clear routines maximize learning time.",
        "Students independently manage routines and transitions."
      ]
    },
    {
      "id": "domain4",
      "title": "Instructional Design & Engagement",
      "descriptors": [
        "Activities focus primarily on task completion.",
        "Activities align with goals and engage many students.",
        "Learning experiences are purposeful, engaging, and aligned.",
        "Students drive learning through inquiry and authentic application."
      ]
    },
    {
      "id": "domain5",
      "title": "Cooperative Learning & Student Discourse",
      "descriptors": [
        "Student talk is limited.",
        "Structured discussion opportunities exist.",
        "Cooperative structures promote meaningful discourse.",
        "Students independently engage in rich academic discourse."
      ]
    },
    {
      "id": "domain6",
      "title": "Questioning & Higher-Order Thinking",
      "descriptors": [
        "Questions focus on recall.",
        "Some questions require analysis or reasoning.",
        "Questions challenge students to analyze, evaluate, and justify.",
        "Students generate questions and engage in deep thinking."
      ]
    },
    {
      "id": "domain7",
      "title": "Formative Assessment & Feedback",
      "descriptors": [
        "Limited checks for understanding.",
        "Assessment informs some instructional decisions.",
        "Frequent formative assessment guides instruction.",
        "Students use self and peer assessment to improve learning."
      ]
    },
    {
      "id": "domain8",
      "title": "Differentiation & Learner Access",
      "descriptors": [
        "Instruction is largely one-size-fits-all.",
        "Some adjustments are evident.",
        "Instruction is intentionally differentiated.",
        "Personalized pathways maximize growth and independence."
      ]
    },
    {
      "id": "domain9",
      "title": "Student Ownership & Agency",
      "descriptors": [
        "Students rely heavily on teacher direction.",
        "Students demonstrate some independence.",
        "Students monitor progress and reflect on growth.",
        "Students set goals and demonstrate strong self-direction."
      ]
    }
  ],
  "acknowledgements": [
    "Reviewer",
    "School representative",
    "Teacher"
  ],
  "confidentiality": ""
};

function validateProbation_(p,schema=PROBATION_SCHEMA){

 if(!p||typeof p!=='object'||Array.isArray(p))return false;

 const fields=['startDate','observer','reviewPurpose','strengths','growth','actionPlan','recommendation','extensionDuration','newReviewDate','summaryComments','status'];

 if(Object.keys(p).some(k=>!fields.includes(k)&&!['domains','acknowledgements'].includes(k)))return false;

 if(fields.some(k=>(typeof p[k]!=='string'||p[k].length>25000)))return false;

 if(p.reviewPurpose&&!schema.reviewPurposes.includes(p.reviewPurpose))return false;

 if(p.recommendation&&!schema.recommendations.includes(p.recommendation))return false;

 if(p.status&&!['Draft','Complete'].includes(p.status))return false;

 if(!p.domains||Object.keys(p.domains).length!==9||Object.keys(p.domains).some(k=>!schema.domains.some(d=>d.id===k)))return false;

 for(const d of Object.values(p.domains))if(!d||Object.keys(d).some(k=>!['rating','evidence','followUp'].includes(k))||typeof d.evidence!=='string'||d.evidence.length>25000||!['',...PROBATION_SCHEMA.levels].includes(d.rating)||!['','Yes','No'].includes(d.followUp))return false;

 if(!Array.isArray(p.acknowledgements)||p.acknowledgements.length!==3)return false;

 return p.acknowledgements.every(a=>a&&Object.keys(a).every(k=>['name','signature','date'].includes(k))&&['name','signature','date'].every(k=>typeof a[k]==='string'&&a[k].length<=500));

}

function validateGuideDefaults_(passages){return passages&&typeof passages==='object'&&!Array.isArray(passages)&&Object.keys(passages).length<=150&&Object.entries(passages).every(([key,value])=>/^[a-zA-Z][a-zA-Z0-9]*-[1-9][0-9]{0,2}$/.test(key)&&value&&typeof value.text==='string'&&value.text.length<=40000&&['blue','yellow','cue'].includes(value.role))}

function applyOperation_(s,body,user,revision){
 const row={revision:revision};
 const json=function(value){return value;};
    const op=body.op,now=Date.now();const actor=String(body.actor||'').slice(0,80);const name=String(body.name||'Observer').trim().slice(0,70)||'Observer';

    if(!actor)return json({error:'Observer identity missing.'},400);

    const existing=s.participants.find(p=>p.actor===actor);if(existing){if(existing.user!==user)return json({error:'Observer identity conflict'},403);existing.name=name;existing.lastSeen=now;}else s.participants.push({actor,user,name,lastSeen:now});

    const conflict=message=>json({error:message,conflict:true},409);

    if(op==='probationSave'){

     if(s.protocol!=='probation'||!validateProbation_(body.value,s.template.schema))return json({error:'Invalid probation review'},400);

     if(row.revision!==body.baseRevision)return conflict('This review changed on another screen. Your draft is kept. Export it before reloading.');

     if(typeof body.subject!=='string'||body.subject.length>500||typeof body.date!=='string'||body.date.length>40)return json({error:'Invalid review information'},400);

     s.probation=body.value;s.meta.subject=body.subject;s.meta.date=body.date;

    }else if(op==='teacherLink'){

     if(typeof body.teacherId!=='string'||!body.teacherId||body.teacherId.length>150)return json({error:'Choose a teacher profile'},400);

     if((s.meta.teacherId||'')!==(body.base||''))return conflict('The teacher link changed. Reload before linking.');

     s.meta.teacherId=body.teacherId;

    }else if(op==='visitDelete'||op==='visitRestore'){



     if(row.revision!==body.baseRevision)return conflict('This observation changed. Refresh the homepage and try again.');

     s.deletedVisit=op==='visitDelete';s.visitDeletedAt=now;s.visitDeletedBy=name;

    }else if(op==='noteDelete'||op==='noteRestore'){

     const item=s.notes.find(n=>n.id===body.id);if(!item)return json({error:'Evidence not found'},404);

     if(item.version!==body.baseVersion)return conflict('This evidence changed. Review the latest version before deleting or restoring it.');

     item.deleted=op==='noteDelete';item.version++;item.deletedAt=now;item.deletedBy=name;

    }else if(op==='intervalDelete'||op==='intervalRestore'){

     const t=s.timer;if(t.version!==body.baseVersion)return conflict('The timeline changed. Review it before deleting or restoring an interval.');

     const item=t.segments.find(i=>i.id===body.id);if(!item)return json({error:'Interval not found'},404);

     item.deleted=op==='intervalDelete';item.deletedAt=now;item.deletedBy=name;t.version++;

    }else if(op==='observerGuide'){

     if(typeof body.id!=='string'||!/^([a-zA-Z][a-zA-Z0-9]*-[1-9][0-9]{0,2}|speaker-blue|speaker-yellow)$/.test(body.id))return json({error:'Invalid guide passage'},400);

     if(!body.value||typeof body.value.text!=='string'||body.value.text.length>(body.id.startsWith('speaker-')?120:40000)||!['blue','yellow','cue'].includes(body.value.role))return json({error:'Invalid observer guide'},400);

     s.observerGuide=s.observerGuide||{};const previous=s.observerGuide[body.id]?.value||null;

     if(JSON.stringify(previous)!==JSON.stringify(body.base||null))return conflict('Another observer changed this script passage. Review their version before saving.');

     if(!s.observerGuide[body.id]&&Object.keys(s.observerGuide).length>=200)return json({error:'Guide passage limit reached'},400);

     s.observerGuide[body.id]={value:{text:body.value.text,role:body.value.role},updatedBy:name,updatedAt:now};

     s.history.push({at:now,by:name,actor,op:'observer_guide_revision',key:body.id,detail:{previousValue:previous,value:s.observerGuide[body.id].value}});

    }else if(op==='phase'){

     if(!['Beginning','Middle','End'].includes(body.phase)||typeof body.selected!=='boolean')return json({error:'Invalid lesson phase'},400);

     const values=new Set(s.meta.phase);if(body.selected)values.add(body.phase);else values.delete(body.phase);s.meta.phase=['Beginning','Middle','End'].filter(p=>values.has(p));

    }else if(op==='form'){

     const schema={wm:['timestamp','principle','details'],processing:['timestamp','minutes','details'],target:['target','indicator0','indicator1','indicator2','indicator3','indicator4','indicator5','indicator6','indicator7','indicator8','rubrics','successCriteria','exemplars'],student:['name','target','value','evidence'],rapport:['strategy','details'],management:['strategy','details'],cooperative:['structure','frequency','details','piesP','piesI','piesE','piesS'],questioning:['thinkTime','respondents','question','activity'],assessment:['strategy','who','details'],feedback:['whoTeacher','whoPeer','whoSelf','basic','instructional','coaching','feedbackBasic','feedbackInstructional','feedbackCoaching','basicStrategy','instructionalStrategy','coachingStrategy'],differentiation:['intuitive','intentional','content','process','product','readiness','interest','preference','engagement','representation','actionExpression','details'],learning:['principle','duration','details','receptiveReading','receptiveDiscussion','activeReading','activeDiscussion'],intangibles:['details']};

     schema.differentiation.push(...Array.from({length:20},(_,i)=>'strategy'+i));schema.targetEvidence=[...schema.target,'details'];for(const keys of Object.values(schema))keys.push('additionalDetails');if(!schema[body.recordType]||typeof body.recordId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(body.recordId))return json({error:'Invalid form row'},400);

     s.formRecords=s.formRecords||{};const existing=s.formRecords[body.recordId];

     if(existing&&existing.type!==body.recordType)return json({error:'Row type cannot change'},400);

     if(!['_create','_remove','_restore'].includes(body.field)&&!schema[body.recordType].includes(body.field))return json({error:'Invalid form field'},400);

     const entry=existing||{id:body.recordId,type:body.recordType,fields:{},author:name,user,createdAt:now};

     if(body.field==='_remove'||body.field==='_restore'){

      if(!['targetEvidence','wm','processing','student','rapport','management','cooperative','questioning','assessment','feedback','differentiation','learning','intangibles'].includes(body.recordType))return json({error:'This form item cannot be removed'},400);

      if(body.field==='_remove'){

       if(entry.deleted)return conflict('This row has already been removed.');

       if(JSON.stringify(entry.fields)!==JSON.stringify(body.baseFields||{}))return conflict('Another observer updated this row. Review their changes before removing it.');

       entry.deleted=true;entry.deletedAt=now;entry.deletedBy=name;

      }else{

       if(!entry.deleted||entry.deletedAt!==body.removalStamp)return conflict('This removal has already changed. Refresh the visit.');

       entry.deleted=false;entry.restoredBy=name;entry.restoredAt=now;

      }

     }else if(body.field!=='_create'){

      if(entry.deleted)return conflict('This row was removed. Its saved content is retained; restore it before editing.');

      if(JSON.stringify(entry.fields[body.field]??'')!==JSON.stringify(body.base??''))return conflict('Another observer changed this form field. Your draft is kept for review.');

      if((body.recordType==='differentiation'&&/^strategy\d+$/.test(body.field))||body.field.startsWith('indicator')||['rubrics','successCriteria','exemplars','piesP','piesI','piesE','piesS','whoTeacher','whoPeer','whoSelf','basic','instructional','coaching','intuitive','intentional','content','process','product','readiness','interest','preference','engagement','representation','actionExpression'].includes(body.field)){if(typeof body.value!=='boolean')return json({error:'Invalid tick box'},400);}

      else if(typeof body.value!=='string'||body.value.length>12000)return json({error:'Invalid form value'},400);

      entry.fields[body.field]=body.value;entry.fieldAuthors=entry.fieldAuthors||{};entry.fieldAuthors[body.field]={name,user,at:now};entry.updatedBy=name;entry.updatedAt=now;

     }

     s.formRecords[body.recordId]=entry;

    }else if(op==='presence'){}else if(op==='meta'||op==='reflection'){

     const allowed=op==='meta'?['teacher','subject','date','phase','goal','annualQuestion','className']:['pedagogy','reteach','year','progress','goalProgress','additions','next','support'];if(!allowed.includes(body.key))return json({error:'Unknown field'},400);

     const target=op==='meta'?s.meta:s.reflections;const old=target[body.key]??'';

     if(JSON.stringify(old)!==JSON.stringify(body.base??''))return conflict('Another observer changed this field. Your draft is kept; reload the latest value before replacing it.');

     if(body.key==='phase'){if(!Array.isArray(body.value)||body.value.some(v=>!['Beginning','Middle','End'].includes(v)))return json({error:'Invalid lesson phase'},400);}else if(typeof body.value!=='string'||body.value.length>(body.key==='goalProgress'?25000:12000))return json({error:'Invalid field value'},400);

     target[body.key]=body.value;

    }else if(op==='consolidateEntries'){

     if(s.reflections.goalProgress===undefined&&(s.meta.goal||s.reflections.progress)){s.reflections.goalProgress=[s.meta.goal?'Annual Pedagogical Goal:\n'+s.meta.goal:'',s.reflections.progress?'Progress:\n'+s.reflections.progress:''].filter(Boolean).join('\n\n');s.history.push({at:now,by:name,actor,op:'combined_goal_progress',detail:{goal:s.meta.goal||'',progress:s.reflections.progress||'',combined:s.reflections.goalProgress}});}

     s.formRecords=s.formRecords||{};

     const put=(id,type,fields,n)=>{if(!s.formRecords[id])s.formRecords[id]={id,type,fields,author:n.author||name,user:n.user||user,createdAt:n.createdAt||now,sourceNoteId:n.id};};

     for(const n of s.notes){if(n.deleted||n.formRecordId||['learning','bloom'].includes(n.kind))continue;const domain=n.domain||n.band;const id='import-'+n.id;const f=n.fields||{};const remaining={...f};const take=key=>{delete remaining[key];return f[key]||''};let type=['rapport','management','cooperative','assessment','feedback','differentiation','intangibles'].includes(domain)?domain:domain==='target'?'targetEvidence':domain==='memory'?'wm':'intangibles';const fields={};

      if(['rapport','management','cooperative'].includes(type)){fields.strategy=n.strategy||'';fields.details=n.text||'';}

      if(type==='cooperative'){fields.structure=n.strategy||'';delete fields.strategy;fields.frequency=take('frequency');const pies=take('pies');for(const [i,key] of ['piesP','piesI','piesE','piesS'].entries())fields[key]=Array.isArray(pies)&&pies.includes(['Positive interdependence','Individual accountability','Equal participation','Simultaneous interaction'][i]);}

      if(type==='assessment'){fields.details=[n.text,take('check')].filter(Boolean).join('\n\n');}

      if(type==='feedback'){const who=take('who'),types=take('type');for(const [key,value] of [['whoTeacher','Teacher'],['whoPeer','Peer-to-peer'],['whoSelf','Student self']])fields[key]=Array.isArray(who)&&who.includes(value);for(const [key,value] of [['basic','Basic'],['instructional','Instructional'],['coaching','Coaching / questions']])fields[key]=Array.isArray(types)&&types.includes(value);fields.feedbackBasic=take('basic');fields.feedbackInstructional=take('instructional');fields.feedbackCoaching=take('coaching');fields.additionalDetails=n.text||'';}

      if(type==='differentiation'){fields.details=n.text||'';for(const [source,items] of [['method',[['intuitive','Intuitive'],['intentional','Intentional']]],['area',[['content','Content'],['process','Process'],['product','Product']]],['access',[['readiness','Readiness'],['interest','Interest'],['preference','Learner preference']]],['udl',[['engagement','Engagement'],['representation','Representation'],['actionExpression','Action and expression']]]]){const values=take(source);for(const [key,label] of items)fields[key]=Array.isArray(values)&&values.includes(label);}}

      if(type==='intangibles')fields.details=n.text||'';

      if(type==='targetEvidence'){fields.target=take('target');fields.details=n.text||'';const indicators=take('indicators');const labels=['Student-friendly active statement','Accessing prior knowledge','Unpacked during class','Constantly displayed','Rubrics / success criteria / exemplars','Real-world connections','Performance / learning by doing','Formative check during class','Reviewed at end of class'];labels.forEach((label,i)=>fields['indicator'+i]=Array.isArray(indicators)&&indicators.includes(label));const student={name:take('student'),target:take('studentTarget'),value:take('studentValue'),evidence:take('studentEvidence')};if(Object.values(student).some(Boolean))put(id+'-student','student',student,n);}

      if(type==='wm'){fields.details=n.text||'';fields.timestamp=take('inputTime');fields.principle='';const processing={timestamp:take('processingTime'),details:take('processing')};if(Object.values(processing).some(Boolean))put(id+'-processing','processing',processing,n);}

      const extra=Object.entries(remaining).filter(([key,value])=>value!==''&&value!==undefined&&value!==null).map(([key,value])=>key+': '+(Array.isArray(value)?value.join(', '):typeof value==='object'?JSON.stringify(value):String(value))).join('\n');if(extra)fields.additionalDetails=[fields.additionalDetails,extra].filter(Boolean).join('\n\n');put(id,type,fields,n);n.formRecordId=id;

     }

    }else if(op==='learningImport'){

     const defaults={'learning-lecture':'lecture','learning-av':'av','learning-modeling':'modeling','learning-receptive':'rr','learning-active':'ar','learning-pair':'pair_team','learning-doing':'doing','learning-teaching':'teaching'};

     const names={'lecture / direct instruction':'lecture','audio / visual':'av','demonstration / modeling':'modeling','receptive reading (rr)':'rr','active reading (ar)':'ar','receptive class discussion (rcd)':'rcd','active class discussion (acd)':'acd','pair / team discussion':'pair_team','learning by doing':'doing','teaching others':'teaching','reading':'rr','class discussion':'rcd'};

     for(const entry of Object.values(s.formRecords||{})){if(entry.type!=='learning'||entry.deleted||entry.importedNoteId)continue;const f=entry.fields||{};if(!Object.values(f).some(v=>String(v).trim()))continue;const mode=defaults[entry.id]||names[String(f.principle||'').toLowerCase()]||'unknown';const band=['rr','ar','rcd','acd'].includes(mode)?'reading_discussion':mode==='unknown'?'unassigned':mode;const text=[f.details,f.receptiveReading?'Receptive Reading: '+f.receptiveReading:'',f.receptiveDiscussion?'Receptive Class Discussion: '+f.receptiveDiscussion:'',f.activeReading?'Active Reading: '+f.activeReading:'',f.activeDiscussion?'Active Class Discussion: '+f.activeDiscussion:''].filter(Boolean).join('\n\n');const noteId='learning-'+entry.id;if(!s.notes.some(n=>n.id===noteId))s.notes.push({id:noteId,text,fields:{duration:f.duration||'',originalPrinciple:f.principle||''},kind:'learning',band,mode,domain:'',author:entry.author||name,user:entry.user||user,actor,createdAt:entry.createdAt||now,version:1});entry.importedNoteId=noteId;}

    }else if(op==='questioningImport'){

     for(const entry of Object.values(s.formRecords||{})){if(entry.type!=='questioning'||entry.deleted||entry.importedNoteId)continue;const f=entry.fields||{};if(!Object.values(f).some(v=>String(v).trim()))continue;const noteId='questioning-'+entry.id;if(!s.notes.some(n=>n.id===noteId))s.notes.push({id:noteId,text:f.question||'',fields:{thinkTime:f.thinkTime??'',respondents:f.respondents??'',activity:f.activity||''},kind:'bloom',band:'unassigned',domain:'',author:entry.author||name,user:entry.user||user,actor,createdAt:entry.createdAt||now,version:1});entry.importedNoteId=noteId;}

    }else if(op==='notes'){

     if(!Array.isArray(body.notes)||body.notes.length>30)return json({error:'Too many boxes in one save'},400);

     for(const n of body.notes){if(typeof n.id!=='string'||typeof n.text!=='string'||n.text.length>12000)return json({error:'Invalid evidence box'},400);const old=s.notes.find(v=>v.id===n.id);if(old&&old.deleted)return conflict('This evidence was deleted. Restore it before editing.');if(old&&old.version!==n.baseVersion)return conflict('An evidence box was edited by another observer. Your draft is kept. Close and reopen the band to review the latest version.');}

     for(const n of body.notes){const old=s.notes.find(v=>v.id===n.id);if(old){old.text=n.text;if(old.kind==='learning'&&['lecture','av','modeling','reading_discussion','pair_team','doing','teaching','unassigned'].includes(n.band))old.band=n.band;if(old.kind==='bloom'&&['create','synthesize','evaluate','analyze','apply','understand','recognize','unassigned'].includes(n.band))old.band=n.band;old.fields=n.fields||{};old.mode=n.mode||old.mode;old.strategy=n.strategy||'';old.updatedBy=name;old.updatedAt=now;old.version++;}else if(n.text.trim()||(['bloom','learning'].includes(n.kind)&&Object.values(n.fields||{}).some(v=>String(v).trim())))s.notes.push({id:n.id,text:n.text,fields:n.fields||{},kind:String(n.kind||'domain'),band:String(n.band||''),domain:String(n.domain||''),mode:String(n.mode||''),strategy:String(n.strategy||''),actor,author:name,user,createdAt:now,version:1});}

    }else if(op==='timer'||op==='reflectionTimer'||op==='rowReflectionTimer'){

     if(op==='reflectionTimer'){

      if(s.reflectionTimer){const previous=s.reflectionTimer;const segments=[...(previous.segments||[]),...(previous.running&&previous.current?[{...previous.current,end:now}]:[])];s.legacySharedReflectionTimer={...previous,running:false,status:'archived',segments,current:null,archivedAt:now};if(segments.length)s.history.push({at:now,by:name,actor,op:'reflection_timer_archive',detail:{segments,status:previous.status||'paused',legacyShared:true}});delete s.reflectionTimer;}

      s.reflectionTimers=s.reflectionTimers||{};

     }

     if(op==='rowReflectionTimer'){if(typeof body.recordId!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(body.recordId)||(!s.formRecords?.[body.recordId]&&!body.recordId.startsWith('processing-'))||(s.formRecords?.[body.recordId]&&s.formRecords[body.recordId].type!=='processing')||s.formRecords?.[body.recordId]?.deleted)return json({error:'Choose an active reflection row'},400);s.rowReflectionTimers=s.rowReflectionTimers||{};s.rowReflectionTimers[user]=s.rowReflectionTimers[user]||{}}

     const t=op==='rowReflectionTimer'?(s.rowReflectionTimers[user][body.recordId]||(s.rowReflectionTimers[user][body.recordId]={running:false,status:'idle',segments:[],current:null,version:0,observer:user,recordId:body.recordId})):op==='timer'?s.timer:(s.reflectionTimers[user]||(s.reflectionTimers[user]={running:false,status:'idle',segments:[],current:null,version:0,observer:user}));if(t.version!==body.baseVersion)return conflict(op!=='timer'?'Your Reflection Timer changed on another screen. Review its latest state.':'The shared timer changed on another screen. The latest timeline has been loaded.');

     const valid=['unknown','lecture','av','modeling','rr','ar','rcd','acd','pair_team','doing','teaching'];if(!valid.includes(body.mode))return json({error:'Choose an activity'},400);

     if(!['start','pause','stop','reset','switch'].includes(body.action))return json({error:'Invalid timer action'},400);

     if(body.action==='start'&&t.status==='stopped')return conflict('Reset the stopped timer before starting again.');

     if(body.action==='start'&&t.running)return conflict('The timer is already running.');

     if(body.action==='switch'&&!t.running)return conflict('Start the observation timer first.');

     if(body.action==='pause'&&!t.running)return conflict('The timer is already paused.');

     if(body.action==='stop'&&t.status==='stopped')return conflict('The timer has already stopped.');

     if(body.action==='stop'&&!t.running&&!t.segments.length)return conflict('Start the timer before stopping it.');

     if(t.running&&t.current)t.segments.push({...t.current,end:now,endedBy:name});

     if(body.action==='reset'){s.history.push({at:now,by:name,actor,op:op!=='timer'?'reflection_timer_archive':'timer_archive',detail:{segments:t.segments,status:t.status||'paused',recordId:body.recordId||null}});t.segments=[];t.running=false;t.status='idle';t.current=null;}

     else{t.running=body.action==='start'||body.action==='switch';t.status=t.running?'running':body.action==='stop'?'stopped':'paused';t.current=t.running?{id:Utilities.getUuid(),mode:body.mode,start:now,author:name,actor}:null;}t.version++;

    }else if(op==='segment'){

     const t=s.timer;if(t.version!==body.baseVersion)return conflict('The timeline changed. Reopen the interval to edit it.');const seg=t.segments.find(v=>v.id===body.id);if(!seg)return json({error:'Interval not found'},404);if(!['unknown','lecture','av','modeling','rr','ar','rcd','acd','pair_team','doing','teaching'].includes(body.mode))return json({error:'Invalid activity'},400);seg.mode=body.mode;seg.editedBy=name;seg.editedAt=now;t.version++;

    }else return json({error:'Unknown update'},400);

    if(op!=='presence')s.history.push({at:now,by:name,actor,op,key:body.recordId||body.key||'',detail:(op==='timer'||op==='reflectionTimer'||op==='rowReflectionTimer')?body.action:op==='notes'?body.notes.map(n=>({id:n.id,text:n.text,kind:n.kind,band:n.band,domain:n.domain,mode:n.mode,fields:n.fields,strategy:n.strategy})):op==='form'?{recordId:body.recordId,recordType:body.recordType,field:body.field,value:body.value??null,previousValue:body.base??null,...(body.baseFields?{fields:body.baseFields}:{})}:body.value??body.mode});


 return s;
}

function studioDateValid_(s){return typeof s==='string'&&(!s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s)}

function studioReviewComplete_(p,meta,schema){
 if(!studioDateValid_(meta.date)||!studioDateValid_(p.startDate)||!studioDateValid_(p.newReviewDate)||p.acknowledgements.some(a=>!studioDateValid_(a.date)))throw Error('Enter valid review dates.');
 if(p.status!=='Complete')return;
 const required=[meta.teacher,meta.subject,meta.date,p.startDate,p.observer,p.reviewPurpose,p.strengths,p.growth,p.actionPlan,p.recommendation,p.summaryComments];
 if(required.some(x=>!String(x||'').trim())||schema.domains.some(d=>{const v=p.domains[d.id];return !v?.rating||!v.evidence.trim()||!v.followUp}))throw Error('Complete the review information, ratings, evidence, follow-up flags and summary before marking Complete.');
 if(p.recommendation===schema.recommendations[1]&&(!p.extensionDuration.trim()||!p.newReviewDate))throw Error('An extension needs its duration and new review date.');
}

function scheduleDay_(d){return new Date(d+'T12:00:00Z')}

function scheduleISO_(d){return d.toISOString().slice(0,10)}

function scheduleMonth_(date,n){const d=scheduleDay_(date),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return scheduleISO_(d)}

function scheduleRecommend_(teacher,protocol,start,end,observers,existing){
 if(!studioDateValid_(start)||!start||!studioDateValid_(end)||end<start)throw Error('Enter a valid start and end date.');
 const first=+scheduleDay_(start),last=+scheduleDay_(end),day=86400000,count=protocol==='probation'?settings.probationMonths:settings.tboVisits;
 if(protocol==='tbo'&&(last-first<120*day||last-first>366*day))throw Error('Choose a TBO year between 120 and 367 days.');
 const result=[];for(let i=0;i<count;i++){
  const low=protocol==='probation'?+scheduleDay_(scheduleMonth_(start,i)):first+Math.floor((last-first+day)*i/count/day)*day;
  const high=protocol==='probation'?+scheduleDay_(scheduleMonth_(start,i+1))-day:first+Math.floor((last-first+day)*(i+1)/count/day)*day-day;
  const mid=Math.floor((low+high)/2/day)*day+12*3600000,candidates=[];
  for(let date=low;date<=high;date+=day){const d=new Date(date);if(!settings.workingDays.includes(d.getUTCDay()))continue;const iso=scheduleISO_(d);for(const time of settings.candidateTimes)for(const observer of observers){const all=existing.concat(result).filter(e=>!e.deleted&&e.status!=='Cancelled'),same=all.filter(e=>e.date===iso&&e.time===time);if(same.some(e=>e.observer===observer||e.teacherId===teacher.id))continue;if(!candidateAvailable({teacherId:teacher.id,observer,date:iso,time}))continue;const distance=Math.abs(date-mid)/day,load=all.filter(e=>e.observer===observer).length;candidates.push({date:iso,time,observer,score:distance+same.length*1000+all.filter(e=>e.date===iso).length*0.1+load*0.15})}}
  candidates.sort((a,b)=>a.score-b.score||a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.observer.localeCompare(b.observer));const c=candidates[0];if(!c)throw Error('No available slot in required month. Add another observer or adjust the cycle.');
  result.push({id:Utilities.getUuid(),teacherId:teacher.id,teacher:teacher.name,protocol,cycleStart:start,cycleEnd:protocol==='probation'?scheduleMonth_(start,settings.probationMonths):end,number:i+1,durationMinutes:settings.durationMinutes,windowStart:scheduleISO_(new Date(low)),windowEnd:scheduleISO_(new Date(high)),date:c.date,time:c.time,observer:c.observer,status:'Planned',visitId:'',notes:''});
 }return result;
}

function scheduleView_(s,user){const rows=scheduleRows_(),map=new Map(rows.map(r=>[r[0],JSON.parse(r[2])]));return {...s,entries:s.entries.filter(e=>!e.deleted).map(e=>{const v=e.visitId?map.get(e.visitId):null;return {...e,linkedMissing:!!e.visitId&&(!v||v.deleted),overdue:e.status!=='Complete'&&e.status!=='Cancelled'&&e.date<Utilities.formatDate(new Date(),settings.timezone,'yyyy-MM-dd')}}),today:Utilities.formatDate(new Date(),settings.timezone,'yyyy-MM-dd'),observers:studioAccess_().users.filter(u=>teachers.some(t=>t.id===u.email&&!t.archived)).map(u=>u.email),isAdmin:studioAccess_().users.some(u=>u.email===user&&u.role==='administrator')};}

function scheduleRpc_(body,user){const lock=LockService.getScriptLock();if(body&&!lock.tryLock(10000))throw Error('Another observer is saving. Try again.');try{const s=scheduleStore_();if(!body)return {ok:true,data:scheduleView_(s,user)};if(JSON.stringify(body).length>30000)throw Error('Schedule update too large.');if(body.baseRevision!==s.revision)return {ok:false,error:'The schedule changed. Refresh it before saving.',conflict:true};const action=body.action;
 
 if(action==='previewMove'||action==='reschedule'){
  const check=scheduleMoveCheck_(s,body);if(action==='previewMove')return {ok:true,data:check};
  if(check.conflicts.length)throw Error(check.conflicts.map(c=>c.reason+': '+c.teacher+' at '+c.time).join('. ')+'. Choose a free time.');
  if(check.outsideWindow&&body.acknowledgeWindow!==true)throw Error('This date is outside the required observation window. Review and explicitly acknowledge the warning.');
  if(!check.noChange){const e=check.entry;e.reschedules=(e.reschedules||[]).concat([{fromDate:e.date,fromTime:e.time,toDate:body.date,toTime:body.time,by:user,at:Date.now(),outsideWindow:check.outsideWindow}]).slice(-30);e.date=body.date;e.time=body.time;scheduleSave_(s);}
  return {ok:true,data:scheduleView_(s,user)};
 }

 if(action==='recommend'){
  const teacher=studioTeacher_(body.teacherId),protocol=body.protocol;if(!['tbo','probation'].includes(protocol))throw Error('Choose a protocol.');const observers=body.observers;if(!Array.isArray(observers)||!observers.length||observers.some(o=>o===teacher.id||!teachers.some(t=>t.id===o&&!t.archived)))throw Error('Choose designated observers.');
  const end=protocol==='probation'?scheduleMonth_(body.start,settings.probationMonths):body.end;if(s.entries.some(e=>!e.deleted&&e.status!=='Cancelled'&&e.teacherId===teacher.id&&e.protocol===protocol&&e.cycleStart<=end&&e.cycleEnd>=body.start))throw Error('This teacher already has an overlapping cycle. Edit the existing schedule.');
  const entries=scheduleRecommend_(teacher,protocol,body.start,end,[...new Set(observers)],s.entries);if(body.preview)return {ok:true,data:{preview:entries,revision:s.revision}};s.entries.push(...entries);
 }else{
  const e=s.entries.find(e=>e.id===body.id&&!e.deleted);if(!e)throw Error('Scheduled observation not found.');
  if(action==='remove'){e.deleted=true;}
  else if(action==='save'){
   if(!body.date||!studioDateValid_(body.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)||body.time<settings.dayStart||body.time>settings.dayEnd)throw Error('Enter a valid date and time within configured working hours.');
   if(body.observer===e.teacherId||!teachers.some(t=>t.id===body.observer&&!t.archived))throw Error('Choose a designated observer.');
   if(!['Planned','Complete','Cancelled'].includes(body.status))throw Error('Choose a valid status.');
   const linked=String(body.visitId||'').trim();if(linked){const row=scheduleRows_().find(r=>r[0]===linked);if(!row)throw Error('Linked observation not found.');const r=studioReadRecord_(row[1]);if(r.state.deletedVisit||r.state.meta.teacherId!==e.teacherId||(r.state.protocol||'tbo')!==e.protocol)throw Error('Choose an active observation for this teacher and protocol.');if(body.status==='Complete'&&e.protocol==='probation'&&r.state.probation.status!=='Complete')throw Error('Complete the probation form before completing this schedule item.');if(s.entries.some(x=>!x.deleted&&x.id!==e.id&&x.visitId===linked))throw Error('This observation is already linked to another schedule item.');}
   if(body.status==='Complete'&&(!linked||body.date>Utilities.formatDate(new Date(),settings.timezone,'yyyy-MM-dd')))throw Error('Completion requires a linked observation and a date no later than today.');
   if(body.status!=='Cancelled'&&(body.date!==e.date||body.time!==e.time||body.observer!==e.observer||e.status==='Cancelled')&&s.entries.some(x=>!x.deleted&&x.id!==e.id&&x.status!=='Cancelled'&&scheduleOverlap_(x,{...e,date:body.date,time:body.time})&&(x.observer===body.observer||x.teacherId===e.teacherId)))throw Error('The observer or teacher already has an observation at that time.');
   const moved=body.date!==e.date||body.time!==e.time, outside=!!(e.windowStart&&e.windowEnd&&(body.date<e.windowStart||body.date>e.windowEnd));
   if(moved&&body.status!=='Cancelled'&&outside&&body.acknowledgeWindow!==true)throw Error('This date is outside the required observation window. Acknowledge the warning before saving.');
   if(moved)e.reschedules=(e.reschedules||[]).concat([{fromDate:e.date,fromTime:e.time,toDate:body.date,toTime:body.time,by:user,at:Date.now(),outsideWindow:outside}]).slice(-30);
   Object.assign(e,{date:body.date,time:body.time,observer:body.observer,status:body.status,visitId:linked,notes:String(body.notes||'').slice(0,2000),lessonId:body.lessonId===undefined?(e.lessonId||null):(body.lessonId||null)});
  }else throw Error('Invalid schedule action.');
 }
 if(s.entries.length>6000)throw Error('Schedule limit reached.');scheduleSave_(s);return {ok:true,data:scheduleView_(s,user)};
 }finally{if(body)lock.releaseLock()}}

function scheduleStartCheck_(body){const s=scheduleStore_();if(s.revision!==body.scheduleBaseRevision)throw Error('The schedule changed. Refresh before starting this visit.');const e=s.entries.find(e=>e.id===body.scheduleEntryId&&!e.deleted);if(!e||e.status!=='Planned'||e.visitId)throw Error('This visit is already linked, completed or removed. Refresh the schedule.');if(e.teacherId!==body.teacherId||e.protocol!==body.protocol)throw Error('The scheduled teacher or protocol does not match.');return e;}

function scheduleOverlap_(a,b){const min=t=>Number(t.slice(0,2))*60+Number(t.slice(3));return a.date===b.date&&min(a.time)<min(b.time)+(b.durationMinutes||60)&&min(b.time)<min(a.time)+(a.durationMinutes||60);}
function scheduleMoveCheck_(s,body){
 const e=s.entries.find(x=>x.id===body.id&&!x.deleted);if(!e||e.status!=='Planned')throw Error('Only planned observations can be rescheduled. Completed and cancelled visits keep their recorded dates.');
 if(!body.date||!studioDateValid_(body.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)||body.time<settings.dayStart||body.time>settings.dayEnd)throw Error('Choose a valid date and time within configured working hours.');
 const minutes=t=>{const p=String(t||'').split(':').map(Number);return p[0]*60+p[1]},start=minutes(body.time);
 const simultaneous=s.entries.filter(x=>!x.deleted&&x.id!==e.id&&x.status!=='Cancelled'&&scheduleOverlap_(x,{...e,date:body.date,time:body.time}));
 const conflicts=simultaneous.filter(x=>x.observer===e.observer||x.teacherId===e.teacherId).map(x=>({id:x.id,teacher:x.teacher,date:x.date,time:x.time,observer:x.observer,reason:x.observer===e.observer?'Observer Already Booked':'Teacher Already Booked'}));
 return {entry:e,conflicts,outsideWindow:!!(e.windowStart&&e.windowEnd&&(body.date<e.windowStart||body.date>e.windowEnd)),weekend:!settings.workingDays.includes(scheduleDay_(body.date).getUTCDay()),concurrent:simultaneous.length-conflicts.length,noChange:body.date===e.date&&body.time===e.time};
}

var ER_LABELS=['Development Needed','Secure Practice','Strength To Share','Not Enough Evidence'];

var ER_AREAS={domain1:['target','targetEvidence'],domain2:['rapport'],domain3:['management'],domain4:['wm','processing','learning'],domain5:['cooperative'],domain6:['questioning'],domain7:['assessment','feedback'],domain8:['differentiation'],domain9:['student']};

function erValue(v){return v&&typeof v==='object'&&!Array.isArray(v)&&'value'in v?v.value:v}

function erFilled(v){v=erValue(v);return typeof v==='boolean'?v:Array.isArray(v)?v.some(erFilled):v&&typeof v==='object'?Object.values(v).some(erFilled):String(v??'').trim()!==''}

function erEntries(s){const entries=[];for(const [id,e] of Object.entries(s.formRecords||{})){if(e.deleted)continue;const fields=Object.fromEntries(Object.entries(e.fields||{}).map(([k,v])=>[k,erValue(v)]));if(!Object.entries(fields).some(([k,v])=>!['timestamp','minutes','time'].includes(k)&&erFilled(v)))continue;entries.push({key:'form:'+id,type:e.type,content:fields,author:e.author||''})}for(const n of s.notes||[]){if(n.deleted||n.formRecordId||!erFilled([n.text,n.fields]))continue;entries.push({key:'note:'+n.id,type:n.kind==='bloom'?'questioning':n.kind==='learning'?'learning':n.domain||n.band,content:{text:n.text||'',fields:n.fields||{}},author:n.author||''})}return entries.map(e=>({...e,fingerprint:erFingerprint([e.type,e.content])}))}

function erFingerprint(value){const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;const text=JSON.stringify(canonical(value));let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i)}return (a>>>0).toString(16)+':'+(b>>>0).toString(16)+':'+text.length}

function erValid(s,review,domain){if(!review||review.removed)return false;const entries=erEntries(s);return review.teacherId===s.meta.teacherId&&review.date===s.meta.date&&review.domain===domain&&ER_LABELS.includes(review.classification)&&review.refs?.length>0&&review.refs.every(ref=>entries.some(e=>e.key===ref.key&&e.fingerprint===ref.fingerprint))}

var erOriginalApply=applyOperation_;

applyOperation_=function(s,body,user,revision){
 if(body.op!=='evidenceReviewSave')return erOriginalApply(s,body,user,revision);
 if(body.baseRevision!==revision)return {error:'This observation changed. Reopen the evidence review before saving.',conflict:true};
 if((s.protocol||'tbo')!=='tbo'||s.deletedVisit)throw Error('Evidence reviews require an active TBO observation.');
 if(!s.meta.teacherId||!s.meta.date||!studioDateValid_(s.meta.date)||s.meta.date>Utilities.formatDate(new Date(),settings.timezone,'yyyy-MM-dd'))throw Error('Link a teacher and enter an observation date no later than today first.');
 const domain=PROBATION_SCHEMA.domains.find(d=>d.id===body.domain);if(!domain)throw Error('Choose a valid area.');
 const previous=s.evidenceReviews?.[domain.id]||null;let review;
 if(body.remove===true)review={removed:true,reviewedBy:user,reviewedAt:Date.now()};else{
 if(!ER_LABELS.includes(body.classification)||typeof body.rationale!=='string'||!body.rationale.trim()||body.rationale.length>4000)throw Error('Choose a conclusion and enter a rationale (up to 4,000 characters).');
 if(!Array.isArray(body.refs)||!body.refs.length||body.refs.length>20||new Set(body.refs).size!==body.refs.length)throw Error('Link between one and twenty evidence entries.');
 const entries=erEntries(s),refs=body.refs.map(key=>{const e=entries.find(x=>x.key===key);if(!e)throw Error('A linked entry was removed or is empty. Reopen the review.');return {key:e.key,fingerprint:e.fingerprint}});
 review={domain:domain.id,domainTitle:domain.title,classification:body.classification,rationale:body.rationale.trim(),refs,teacherId:s.meta.teacherId,date:s.meta.date,reviewedBy:user,reviewedAt:Date.now(),version:1};
 }
 s.evidenceReviews=s.evidenceReviews||{};s.evidenceReviews[domain.id]=review;s.history=s.history||[];s.history.push({at:Date.now(),by:user,op:'evidenceReview',detail:{domain:domain.id,previous,review}});return s;
};

function workflowStage_(s){return s.workflow?.stage||'Not Yet Tracked'}

var workflowApplyBefore_=applyOperation_;

applyOperation_=function(s,body,user,revision){
 const stage=workflowStage_(s);
 if(body.op==='workflowChange'){
  if(body.baseRevision!==revision)return {error:'This observation changed. Refresh its status before trying again.',conflict:true};
  if(s.deletedVisit)throw Error('Restore the observation before changing its status.');
  const next=body.stage,forward={'Not Yet Tracked':'In Progress','In Progress':'Ready For Reflection','Ready For Reflection':'Reflection Complete','Reflection Complete':'Closed'},reason=String(body.reason||'').trim();
  const reopen=next==='In Progress'&&stage!=='Not Yet Tracked'&&stage!=='In Progress';
  if(!reopen&&forward[stage]!==next)throw Error('Choose the next lifecycle step.');
  if(reopen&&(reason.length<3||reason.length>1000))throw Error('Enter a reason for reopening (3–1,000 characters).');
  if(next==='Ready For Reflection'){
   if(!s.meta.teacherId||!s.meta.date||!studioDateValid_(s.meta.date)||s.meta.date>Utilities.formatDate(new Date(),settings.timezone,'yyyy-MM-dd'))throw Error('Link a teacher and enter an observation date no later than today.');
   if(s.protocol==='probation'&&s.probation?.status!=='Complete')throw Error('Complete the probation review before marking it ready for reflection.');
   if(s.protocol!=='probation'&&!erEntries(s).length)throw Error('Record observation evidence before marking it ready for reflection.');
  }
  if(next==='Reflection Complete'&&body.confirmReflection!==true)throw Error('Confirm that the reflection conversation has taken place.');
  if(next==='Closed'){
   const timers=[s.timer,...Object.values(s.reflectionTimers||{}),...Object.values(s.rowReflectionTimers||{}).flatMap(rows=>Object.values(rows||{}))];
   if(timers.some(t=>t?.running))throw Error('Stop all observers’ running timers before closing this observation.');
  }
  s.workflow={...(s.workflow||{}),stage:next,updatedAt:Date.now(),updatedBy:user};
  s.history=s.history||[];s.history.push({at:Date.now(),by:user,op:'workflowChange',detail:{from:stage,to:next,reason:reopen?reason:'',reflectionConfirmed:next==='Reflection Complete'}});return s;
 }
 if(stage==='Closed'&&!['visitDelete','visitRestore','presence','consolidateEntries'].includes(body.op))throw Error('This observation is closed. Reopen it with a reason before editing.');
 if(stage==='Closed'&&['presence','consolidateEntries'].includes(body.op))return s;
 return workflowApplyBefore_(s,body,user,revision);
};

function pdevConflicts_(e,s){const min=t=>Number(t.slice(0,2))*60+Number(t.slice(3)),overlap=x=>x.date===e.date&&min(x.time)<min(e.endTime)&&min(x.endTime||String(Math.floor((min(x.time)+(x.durationMinutes||60))/60)).padStart(2,'0')+':'+String((min(x.time)+(x.durationMinutes||60))%60).padStart(2,'0'))>min(e.time);if(e.status==='Cancelled')return [];const ids=e.participants.map(p=>p.teacherId);return s.sessions.filter(x=>!x.deleted&&x.id!==e.id&&x.status!=='Cancelled'&&overlap(x)&&([x.facilitator,...x.participants.map(p=>p.teacherId)].some(id=>[e.facilitator,...ids].includes(id)))).map(x=>'PD: '+x.title+' ('+x.date+' '+x.time+')').concat(scheduleStore_().entries.filter(x=>!x.deleted&&x.status!=='Cancelled'&&overlap(x)&&([x.teacherId,x.observer].some(id=>[e.facilitator,...ids].includes(id)))).map(x=>'Observation: '+x.teacher+' ('+x.time+')'))}

function pdevClean_(v,old){
 if(!v||typeof v!=='object')throw Error('Enter PD details.');const str=(key,max=2000)=>{const t=String(v[key]||'').trim();if(t.length>max)throw Error(key+' is too long.');return t};
 const e={id:old?.id||Utilities.getUuid(),title:str('title',250),domain:str('domain',30),outcome:str('outcome'),deliverable:str('deliverable'),facilitator:str('facilitator',250),location:str('location',500),resources:str('resources'),date:str('date',10),time:str('time',5),endTime:str('endTime',5),reviewDate:str('reviewDate',10),status:str('status',30)};
 if(!e.title||!e.outcome||!e.deliverable||!e.facilitator||!PROBATION_SCHEMA.domains.some(d=>d.id===e.domain))throw Error('Title, observation area, intended outcome, deliverable and facilitator are required.');
 if(!e.date||!studioDateValid_(e.date)||!e.reviewDate||!studioDateValid_(e.reviewDate)||e.reviewDate<e.date||![e.time,e.endTime].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||e.endTime<=e.time)throw Error('Enter a valid date, end time after start time, and follow-up date on or after the session.');
 const today=Utilities.formatDate(new Date(),settings.timezone,'yyyy-MM-dd');if(!['Planned','Delivered','Cancelled'].includes(e.status)||e.status==='Delivered'&&e.date>today)throw Error('A future session cannot be marked delivered.');
 if(!Array.isArray(v.participants)||!v.participants.length||v.participants.length>500)throw Error('Choose at least one participant (maximum 500).');const teachers=pdevTeachers_();const seen=new Set();e.participants=v.participants.map(p=>{const t=teachers.find(t=>t.id===p.teacherId);if(!t||seen.has(t.id)||t.archived&&!old?.participants.some(x=>x.teacherId===t.id))throw Error('Choose distinct active teacher profiles.');seen.add(t.id);if(!['Not Recorded','Attended','Partial','Absent','Excused'].includes(p.attendance)||!['Not Started','In Progress','Complete'].includes(p.deliverableStatus))throw Error('Choose valid attendance and deliverable statuses.');const minutes=Number(p.minutes||0),duration=(Number(e.endTime.slice(0,2))-Number(e.time.slice(0,2)))*60+Number(e.endTime.slice(3))-Number(e.time.slice(3));if(!Number.isInteger(minutes)||minutes<0||minutes>duration)throw Error('Attendance minutes must be within the session duration.');if(!['Attended','Partial'].includes(p.attendance)&&minutes)throw Error('Only attended or partial attendance can have minutes.');if(e.date>today&&(p.attendance!=='Not Recorded'||p.deliverableStatus!=='Not Started'))throw Error('Do not record attendance or completion for a future session.');const notes=String(p.notes||'');if(notes.length>3000)throw Error('Participant notes are too long.');return {teacherId:t.id,teacher:t.name,attendance:p.attendance,minutes,deliverableStatus:p.deliverableStatus,notes,contributionReview:old?.participants.find(x=>x.teacherId===t.id)?.contributionReview||null}});
 return e;
}

function pdevRpc_(body,user){const lock=LockService.getScriptLock();if(body&&!lock.tryLock(10000))throw Error('Another PD update is saving. Your draft is kept; retry.');try{const s=pdevStore_();if(!body)return {ok:true,data:pdevView_(s)};if(body.baseRevision!==s.revision)return {ok:false,conflict:true,error:'PD records changed. Close and reopen this session before retrying; your current inputs have not been saved.'};const old=s.sessions.find(e=>e.id===body.id&&(!e.deleted||body.action==='restore'));if(body.action==='restore'){if(!old||!old.deleted||old.demoRemoved)throw Error('This session is not available to restore.');delete old.deleted;const conflicts=pdevConflicts_(old,s);if(conflicts.length)throw Error('Scheduling overlap: '+conflicts.join('; '));old.updatedAt=Date.now();old.updatedBy=user;}else if(body.action==='remove'){if(!old)throw Error('PD session not found.');old.deleted=true;old.updatedBy=user;old.updatedAt=Date.now();}else if(body.action==='save'||body.action==='preview'){if(body.id&&!old)throw Error('PD session not found.');const e=pdevClean_(body.value,old),warnings=pdevConflicts_(e,s);if(body.action==='preview')return {ok:true,data:{warnings}};if(warnings.length)return {ok:false,error:'Scheduling overlap: '+warnings.join('; ')+'. Choose a time without participant clashes.'};e.updatedBy=user;e.updatedAt=Date.now();e.history=(old?.history||[]).concat([{at:e.updatedAt,by:user,action:'save',overlaps:warnings}]).slice(-100);if(old)s.sessions[s.sessions.indexOf(old)]=e;else s.sessions.push(e);}else throw Error('Unknown PD action.');pdevSave_(s);return {ok:true,data:pdevView_(s)}}finally{if(body)lock.releaseLock()}}
return {apply:applyOperation_,templates:studioTemplates_,templateRpc:studioTemplateRpc_,scheduleRpc:scheduleRpc_,scheduleCheck:scheduleStartCheck_,pdRpc:pdevRpc_,validateProbation:validateProbation_,reviewComplete:studioReviewComplete_,validateGuide:validateGuideDefaults_,entries:erEntries};
};
