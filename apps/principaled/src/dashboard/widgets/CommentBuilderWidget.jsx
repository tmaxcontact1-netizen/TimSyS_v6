import React,{useEffect,useState,useRef} from 'react';
import client from '../../api/client';
import {generated,unresolved,csv,checkComment,checkBank,grammar} from './comment-builder-utils.mjs';
import {previewBank,adjacentStudent,bankTotal,scanBank,scanNeighbours,scanMessages} from './comment-builder-bank.mjs';
import './comment-builder.css';

export default function CommentBuilderWidget(){
  const [data,setData]=useState(null),[classId,setClassId]=useState(''),[q,setQ]=useState(1),[tab,setTab]=useState('students');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false);
  const [className,setClassName]=useState(''),[rename,setRename]=useState(''),[name,setName]=useState(''),[pronoun,setPronoun]=useState('they'),[editing,setEditing]=useState(null);
  const [bank,setBank]=useState(null),[studentId,setStudentId]=useState(''),[draft,setDraft]=useState(null),[dirty,setDirty]=useState(false);
  const [target,setTarget]=useState(''),[findings,setFindings]=useState(null),[checking,setChecking]=useState(false),[copyFrom,setCopyFrom]=useState(1),[confirmation,setConfirmation]=useState(null);
  const [retry,setRetry]=useState(null),[recovery,setRecovery]=useState(null),[download,setDownload]=useState(null);
  const checkRun=useRef(0),liveRun=useRef(0);
  const [liveEdit,setLiveEdit]=useState(null),[liveFeedback,setLiveFeedback]=useState(null),[progress,setProgress]=useState(''),[previewId,setPreviewId]=useState('');
  const c=data?.classes.find(c=>c.id===classId),roster=c?.quarters[q-1]||[],student=roster.find(s=>s.id===studentId);
  useEffect(()=>{load();},[]);
  useEffect(()=>{const warn=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  useEffect(()=>()=>{if(download)URL.revokeObjectURL(download.url);},[download]);
  useEffect(()=>()=>{checkRun.current++;liveRun.current++;},[]);
  useEffect(()=>{
    const run=++liveRun.current;
    if(!bank||!liveEdit||tab!=='bank'||checking)return;
    setLiveFeedback(null);
    const timer=setTimeout(async()=>{
      const result=await scanNeighbours(bank,...liveEdit,{cancelled:()=>run!==liveRun.current});
      if(result&&!result.cancelled&&run===liveRun.current)setLiveFeedback({at:liveEdit,messages:scanMessages(result)});
    },650);
    return()=>{clearTimeout(timer);liveRun.current++;};
  },[bank,liveEdit,tab,checking]);
  async function load(){try{const r=await client.get('/comment-builder/workspace');setData(r.data.workspace);setError('');}catch(e){setError(e.response?.data?.error?.message||e.message);}}
  async function save(input,done=()=>{},envelope=null){
    setBusy(true);setError('');setMessage('');
    const payload=envelope||{...input,expected_revision:data.revision,command_id:crypto.randomUUID()};
    try{const r=await client.post('/comment-builder/commands',payload);const next=r.data.workspace;setData(next);setDirty(false);setRetry(null);setConflict(false);setMessage('Saved');done(next);return true;}
    catch(e){setError(e.response?.data?.error?.message||'Could not save. Your edits are still here.');setConflict(e.response?.status===409);setRetry({input,done,payload});return false;}
    finally{setBusy(false);}
  }
  function navigate(fn){if(dirty){setConfirmation({text:'You have unsaved edits. Discard them and continue?',run:()=>{setDirty(false);fn();}});}else fn();}
  function chooseClass(id){setDownload(null);setPreviewId('');setLiveEdit(null);setLiveFeedback(null);setClassId(id);setRename(data?.classes.find(c=>c.id===id)?.name||'');setQ(1);setTab('students');setBank(null);setDraft(null);setStudentId('');setFindings(null);setEditing(null);setName('');}
  function chooseStudent(s){setPreviewId(s.id);setStudentId(s.id);setDraft(structuredClone(s));setFindings(null);setMessage('');}
  function changeTab(value){navigate(()=>{setTab(value);setBank(value==='bank'?structuredClone(c.categories):null);setDraft(null);setStudentId('');setFindings(null);setName('');setEditing(null);setTarget(data.characterTargets[q-1]??'');});}
  function changeBank(i,fn){
    const next=bank.map((cat,j)=>j===i?fn(cat):cat);
    const option=next[i].options.findIndex((o,j)=>JSON.stringify(o)!==JSON.stringify(bank[i].options[j]));
    checkRun.current++;setChecking(false);setProgress('');setLiveEdit(option>=0?[i,option]:null);setLiveFeedback(null);
    setBank(next);setDirty(true);setFindings(null);
  }
  const wording=draft?(draft.personal??generated(c,draft)):'';
  async function review(){setChecking(true);const base=checkComment(wording,c,draft,data.characterTargets[q-1]);setFindings(base);try{const checks=await grammar(wording);setFindings([...base,...checks,'Checks are advisory. Review the wording yourself before using it.']);}catch{setFindings([...base,'Grammar checker unavailable. Your comment is unchanged; retry the check.']);}finally{setChecking(false);}}
  async function reviewBank(){
    const run=++checkRun.current;liveRun.current++;setChecking(true);setProgress('Starting local bank check…');
    setFindings(checkBank(bank));
    try{const result=await scanBank(bank,{cancelled:()=>run!==checkRun.current,onProgress:p=>{if(run===checkRun.current)setProgress(p.checked.toLocaleString()+' of '+p.total.toLocaleString()+' comments checked');}});
      if(run===checkRun.current){setFindings([...checkBank(bank),...scanMessages(result),'Checks are advisory; no wording has been changed.']);setProgress('');}
    }catch{if(run===checkRun.current)setFindings([...checkBank(bank),'Check could not finish. No wording has been changed.']);}
    finally{if(run===checkRun.current)setChecking(false);}
  }
  function cancelCheck(){checkRun.current++;setChecking(false);setProgress('Check cancelled. No wording has been changed.');}
  async function moveStudent(offset){const next=adjacentStudent(roster,studentId,offset);if(!next)return;if(dirty&&!await saveComment())return;chooseStudent(next);}
  async function copy(){if(dirty&&!await saveComment())return;try{await navigator.clipboard.writeText(wording);setMessage('Comment copied');const next=adjacentStudent(roster,studentId,1);if(next)chooseStudent(next);}catch{setError('Clipboard unavailable. Select the comment text and copy it manually.');}}
  function saveComment(){return save({action:'comment',classId,quarter:q,studentId,selections:draft.selections,personal:draft.personal});}
  function exportCsv(){const blob=new Blob([csv(c,q)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),filename=`${c.name.replace(/[<>:"/\\|?*]/g,'_')} - Q${q} - Comments.csv`;setDownload({url,filename});const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
  async function reloadConflict(){setRecovery(JSON.stringify({classId,quarter:q,bank,draft,name,pronoun,className},null,2));await load();setConflict(false);setRetry(null);setDirty(false);setBank(null);setDraft(null);setStudentId('');setTab('students');setMessage('Saved work reloaded. Your previous edits are retained below for comparison.');}
  if(!data)return <section className="cb"><h2>Comment Builder</h2><p role="status">{error||'Loading your workspace…'}</p>{error&&<button onClick={load}>Retry</button>}</section>;
  return <section className="cb" aria-busy={busy}>
    <header><h2>Comment Builder</h2><p>Your private class lists and comment banks. Build wording, review it, then copy or export.</p></header>
    <p className="cb-steps">Create class → Add students → Build comment bank → Write comments → Copy or export</p>
    {error&&<div role="alert" className="cb-alert">{error} {conflict?<button onClick={reloadConflict} disabled={busy}>Reload saved work and keep a copy of my edits</button>:retry&&<button disabled={busy} onClick={()=>save(retry.input,retry.done,retry.payload)}>Retry save</button>}</div>}
    {message&&<p role="status">{message}</p>}
    {recovery&&<details><summary>Retained edits from before reload</summary><textarea aria-label="Retained unsaved edits" readOnly value={recovery}/><button onClick={()=>setRecovery(null)}>Dismiss retained copy</button></details>}
    {confirmation&&<div className="cb-confirm" role="alertdialog" aria-modal="false" aria-label="Confirm action"><p>{confirmation.text}</p><button autoFocus onClick={()=>setConfirmation(null)}>Keep working</button><button disabled={busy} onClick={()=>{const fn=confirmation.run;setConfirmation(null);fn();}}>Confirm</button></div>}
    <fieldset disabled={busy||checking||conflict} className="cb-controls">
    <div className="cb-toolbar"><label>Class<select value={classId} onChange={e=>navigate(()=>chooseClass(e.target.value))}><option value="">Choose a class</option>{data.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <form onSubmit={e=>{e.preventDefault();navigate(()=>save({action:'createClass',name:className},next=>{chooseClass(next.classes.at(-1).id);setClassName('');}));}}><label>New class name<input required maxLength={48} value={className} onChange={e=>setClassName(e.target.value)}/></label><button>Create class</button></form></div>
    {!data.classes.length&&<div className="cb-empty"><h3>Start with your first class</h3><p>No students, scores or comment wording have been added. Give your class a name above to begin.</p></div>}
    {c&&<>
      <div className="cb-toolbar"><label>Quarter<select value={q} onChange={e=>navigate(()=>{setQ(Number(e.target.value));setStudentId('');setDraft(null);setTab('students');setBank(null);setName('');setEditing(null);setFindings(null);})}>{[1,2,3,4].map(n=><option key={n} value={n}>Quarter {n}</option>)}</select></label><button className="cb-danger" onClick={()=>setConfirmation({text:`Permanently delete ${c.name}? This removes all four quarter lists, selections, personal comments and this class’s bank. Other classes are unaffected.`,run:()=>save({action:'deleteClass',classId,confirmId:classId},()=>chooseClass(''))})}>Delete class</button></div>
      <nav aria-label="Comment Builder steps">{[['students','Students'],['bank','Comment bank'],['comments','Write comments']].map(([id,label])=><button key={id} aria-current={tab===id?'step':undefined} onClick={()=>changeTab(id)}>{label}</button>)}</nav>
      {tab==='students'&&<>
        <form className="cb-toolbar" onSubmit={e=>{e.preventDefault();save({action:'renameClass',classId,name:rename});}}><label>Class name<input value={rename||c.name} maxLength={48} onChange={e=>{setRename(e.target.value);setDirty(true);}}/></label><button disabled={!!name}>Rename class</button></form><h3>{c.name} · Quarter {q} students</h3><p>Each quarter has its own list and saved comments.</p>
        <form className="cb-toolbar" onSubmit={e=>{e.preventDefault();save({action:editing?'editStudent':'addStudent',classId,quarter:q,studentId:editing,name,pronoun},()=>{setName('');setEditing(null);});}}><label>Student name<input required maxLength={80} value={name} onChange={e=>{setName(e.target.value);setDirty(true);}}/></label><label>Pronouns<select value={pronoun} onChange={e=>{setPronoun(e.target.value);setDirty(true);}}><option value="they">They / them</option><option value="she">She / her</option><option value="he">He / him</option></select></label><button>{editing?'Save student':'Add student'}</button>{editing&&<button type="button" onClick={()=>navigate(()=>{setName('');setEditing(null);})}>Cancel edit</button>}</form>
        {!roster.length&&<div className="cb-empty"><p>This quarter’s class list is empty.</p><label>Copy students from<select value={copyFrom} onChange={e=>setCopyFrom(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>Quarter {n}</option>)}</select></label><button disabled={copyFrom===q||!c.quarters[copyFrom-1].length} onClick={()=>navigate(()=>save({action:'copyRoster',classId,quarter:q,fromQuarter:copyFrom}))}>Copy names and pronouns only</button><p>Selections and comments are not copied.</p></div>}
        <ul className="cb-students">{roster.map(s=><li key={s.id}><span>{s.name} <small>({s.pronoun})</small></span><button onClick={()=>navigate(()=>{setEditing(s.id);setName(s.name);setPronoun(s.pronoun);})}>Edit {s.name}</button><button onClick={()=>setConfirmation({text:`Delete ${s.name} from Quarter ${q}? Their selections and personal comment in this quarter will also be deleted. Other quarters are unaffected.`,run:()=>save({action:'deleteStudent',classId,quarter:q,studentId:s.id,confirmId:s.id},()=>{setEditing(null);setName('');})})}>Delete {s.name}</button></li>)}</ul>
        <button onClick={()=>changeTab('bank')}>Next: build comment bank</button>
      </>}
      {tab==='bank'&&bank&&<>
        <h3>Comment bank</h3><p>Used across this class’s four quarters. Personal edits keep their wording. Empty categories are allowed.</p><p>Placeholders: {'{name}, {namePoss}, {he}, {him}, {his}, {heCap}, {hisCap}, {subject}, {object}, {possessive}'}. Nothing is filled until you write it.</p>
        {bank.map((cat,i)=><fieldset key={cat.id} className="cb-category"><legend>Category {i+1}</legend><label>Heading<input maxLength={48} value={cat.name} onChange={e=>changeBank(i,cat=>({...cat,name:e.target.value}))}/></label>{cat.options.map((o,j)=><div key={o.id||`new-${j}`} className="cb-option"><label>Option {j+1}<textarea maxLength={400} value={o.text} onChange={e=>changeBank(i,cat=>({...cat,options:cat.options.map((v,k)=>j===k?{...v,text:e.target.value}:v)}))}/></label><div className="cb-toolbar"><label>Skill tag (optional)<input maxLength={80} value={o.skill||''} onChange={e=>changeBank(i,cat=>({...cat,options:cat.options.map((v,k)=>j===k?{...v,skill:e.target.value}:v)}))}/></label><label>Skill level<select value={o.level||''} onChange={e=>changeBank(i,cat=>({...cat,options:cat.options.map((v,k)=>j===k?{...v,level:e.target.value}:v)}))}><option value="">Not specified</option><option value="consistent">Consistent</option><option value="developing">Developing</option><option value="rare">Rare</option></select></label><button onClick={()=>changeBank(i,cat=>({...cat,options:cat.options.filter((_,k)=>k!==j)}))}>Remove option {j+1}</button></div><p className="cb-example" aria-live="polite"><strong>Full comment example · {roster.find(s=>s.id===previewId)?.name||roster[0]?.name||'Student'}</strong><br/>{previewBank(bank,i,j,roster.find(s=>s.id===previewId)||roster[0])||'Add wording to see an example.'}</p>{liveFeedback?.at[0]===i&&liveFeedback?.at[1]===j&&<div className="cb-live-check" role="status">{liveFeedback.messages.map((m,k)=><p key={k}>{m}</p>)}</div>}</div>)}<button disabled={cat.options.length>=20} onClick={()=>changeBank(i,cat=>({...cat,options:[...cat.options,{id:null,text:'',skill:'',level:''}]}))}>Add option to {cat.name}</button></fieldset>)}
        <div className="cb-toolbar"><button onClick={()=>save({action:'bank',classId,categories:bank},next=>setBank(structuredClone(next.classes.find(c=>c.id===classId).categories)))}>Save comment bank</button><button onClick={reviewBank}>Check all bank combinations</button><span>{bankTotal(bank).toLocaleString()} comments across she, he and they forms</span><button onClick={()=>changeTab('comments')}>Next: write comments</button></div>
      </>}
      {tab==='comments'&&<>
        <h3>Write comments · Quarter {q}</h3>{!roster.length?<p>Add students to this quarter first.</p>:<>
        <div className="cb-toolbar"><label>Student<select value={studentId} onChange={e=>navigate(()=>{const s=roster.find(s=>s.id===e.target.value);if(s)chooseStudent(s);else{setStudentId('');setDraft(null);}})}><option value="">Choose a student</option>{roster.map(s=><option key={s.id} value={s.id}>{s.name}{unresolved(c,s).length?' — review needed':''}</option>)}</select></label><button disabled={dirty} onClick={exportCsv}>Export saved class CSV</button></div>
        <form className="cb-toolbar" onSubmit={e=>{e.preventDefault();navigate(()=>save({action:'target',quarter:q,value:target===''?null:Number(target)}));}}><label>Character recommendation (optional, all classes in this quarter)<input type="number" min="1" max="100000" value={target} onChange={e=>setTarget(e.target.value)}/></label><button disabled={dirty}>Save recommendation</button></form>
        {student&&draft&&<><h4>{student.name}</h4>{unresolved(c,draft).length>0&&<p role="alert" className="cb-alert">A selected option was removed. Choose replacement wording or clear the selection. Personal wording is preserved.</p>}
        <div className="cb-fragments">{c.categories.map((cat,i)=><label key={cat.id}>{cat.name}<select value={draft.selections[i]||''} onChange={e=>{setDraft({...draft,selections:draft.selections.map((v,j)=>i===j?(e.target.value||null):v)});setDirty(true);setFindings(null);}}><option value="">{cat.options.length?'Not selected':'No wording configured'}</option>{draft.selections[i]&&!cat.options.some(o=>o.id===draft.selections[i])&&<option value={draft.selections[i]}>Removed option — review needed</option>}{cat.options.map(o=><option key={o.id} value={o.id}>{o.text}</option>)}</select></label>)}</div>
        <label>Combined comment<textarea className="cb-comment" maxLength={2500} value={wording} onChange={e=>{setDraft({...draft,personal:e.target.value});setDirty(true);setFindings(null);}}/></label><p>{Array.from(wording).length} characters · {draft.personal===null?'Generated from your selected wording':'Personal wording'} · {dirty?'Unsaved edits':'Saved'}</p>
        <div className="cb-toolbar"><button disabled={!adjacentStudent(roster,studentId,-1)} onClick={()=>moveStudent(-1)}>Previous student</button><button disabled={!adjacentStudent(roster,studentId,1)} onClick={()=>moveStudent(1)}>Next student</button><button onClick={saveComment}>Save comment</button><button disabled={!wording.trim()} onClick={review}>Check comment</button><button disabled={!wording.trim()||!!unresolved(c,draft).length} onClick={copy}>Copy and next student</button>{draft.personal!==null&&<button onClick={()=>setConfirmation({text:'Replace personal wording with the currently selected bank wording? Save the comment to keep this change.',run:()=>{setDraft({...draft,personal:null});setDirty(true);}})}>Restore generated wording</button>}</div>
        </>}
        </>}
      </>}
    </>}
    </fieldset>
    {checking&&<div role="status"><p>{progress||'Checking locally…'}</p>{tab==='bank'&&<button onClick={cancelCheck}>Cancel bank check</button>}</div>}{!checking&&progress&&<p role="status">{progress}</p>}
    {findings&&<section aria-label="Check results" aria-live="polite"><h3>Review findings</h3>{findings.length?<ul>{findings.map((f,i)=><li key={i}>{f}</li>)}</ul>:<p>No issues flagged. Review the wording before using it.</p>}</section>}
    {download&&<p role="status">Export ready: <a href={download.url} download={download.filename}>Download {download.filename}</a></p>}
  </section>;
}
