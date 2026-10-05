import React,{useState} from 'react';
import {ConfirmationDialog,InputDialog} from '../../../../shared-ui/react/index.js';
import {api,post,count} from './presentation.js';
export default function LifecycleActions({kind,id,label,archived=false,actor,disabled=false,onChanged}){
 const [policy,setPolicy]=useState(null),[rename,setRename]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(null),[history,setHistory]=useState(null);
 const noun={datasets:'dataset',imports:'source',sessions:'session',mappings:'prepared source version','unit-sets':'text preparation version'}[kind];
 async function run(action,name){setBusy(true);setError(null);try{const result=await api(`/${kind}/${id}/lifecycle`,post({action,actor,...(name?{label:name}:{})}));setPolicy(null);setRename(false);await onChanged?.(result);}catch(e){setError(e);}finally{setBusy(false);}}
 async function inspect(){setBusy(true);try{setPolicy(await api(`/${kind}/${id}/lifecycle`));}catch(e){setError(e);}finally{setBusy(false);}}
 return <div className="mcf-actions"><details><summary>Actions for {label}</summary>
 {['datasets','imports','sessions'].includes(kind)&&<button disabled={busy||disabled||!actor.trim()} onClick={()=>setRename(true)}>Rename {noun}</button>}
 {archived?<button disabled={busy||disabled||!actor.trim()} onClick={()=>setPolicy({allowedAction:'restore',explanation:'Restore this item to your active work. Its original source and recorded coding will stay unchanged.'})}>Restore {noun}</button>:<button className="danger" disabled={busy||disabled||!actor.trim()} onClick={inspect}>Delete or archive {noun}</button>}
 <button onClick={async()=>{try{setHistory((await api(`/${kind}/${id}/history`)).items);}catch(e){setError(e);}}}>View history</button>
 {history&&<div>{history.length?history.map((h,i)=><p key={i}>{new Date(h.created_at).toLocaleString()} · {h.actor} · {h.action==='rename'?`Renamed to ${h.label}`:h.action==='archive'?'Archived':h.action==='restore'?'Restored':'Deleted'}</p>):<p>No organisational changes recorded.</p>}</div>}</details>
 {error&&<p role="alert">{error.message}</p>}
 <ConfirmationDialog open={!!policy} title={policy?`${policy.allowedAction==='delete'?'Delete':policy.allowedAction==='restore'?'Restore':'Archive'} “${label}”?`:''} description={policy?.explanation} consequence={policy?.counts?`${count(policy.counts.sources,'source document')}, ${count(policy.counts.sessions,'coding session')}, ${count(policy.counts.decisions,'saved decision')}. ${policy.allowedAction==='archive'?'You can restore archived work later.':''}`:''} confirmLabel={policy?.allowedAction==='delete'?`Delete ${noun}`:policy?.allowedAction==='restore'?`Restore ${noun}`:`Archive ${noun}`} destructive={policy?.allowedAction!=='restore'} busy={busy} onConfirm={()=>run(policy.allowedAction)} onCancel={()=>setPolicy(null)}/>
 <InputDialog open={rename} title={`Rename ${noun}`} label="Display name" description={kind==='imports'?'The original filename and source evidence will remain unchanged.':'This changes the name, not the research record.'} initialValue={label} confirmLabel="Save name" onConfirm={name=>run('rename',name)} onCancel={()=>setRename(false)}/>
 </div>;
}
