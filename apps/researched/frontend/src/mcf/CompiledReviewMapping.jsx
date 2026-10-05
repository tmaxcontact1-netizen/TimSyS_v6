import React,{useState} from 'react';

export default function CompiledReviewMapping({preview,save,busy,close}){
 const initial=()=>preview.previousRecords?preview.previousRecords.map(r=>({...r,confirmed:false})):preview.candidates.map(c=>({start:c.start,end:c.end,confirmed:false,institution:{state:'unassigned',name:'',note:''},include:['narrative'],notes:''}));
 const [records,setRecords]=useState(initial),[selected,setSelected]=useState(0),[reason,setReason]=useState('Separate compiled reviews using questionnaire profile'),[split,setSplit]=useState(0),[error,setError]=useState('');
 const record=records[selected];const update=values=>setRecords(records.map((r,i)=>i===selected?{...r,...values,confirmed:false}:r));
 const blocks=record?preview.blocks.slice(record.start,record.end):[];
 const metadata=preview.candidates.find(c=>c.start===record?.start&&c.end===record?.end);
 const confirm=()=>setRecords(records.map((r,i)=>i===selected?{...r,confirmed:true}:r));
 const splitRecord=()=>{if(split<=record.start||split>=record.end){setError('Choose a block inside this review.');return;}setRecords(records.flatMap((r,i)=>i!==selected?[r]:[{...r,end:split,confirmed:false},{...r,start:split,confirmed:false,institution:{state:'unassigned',name:'',note:''}}]));setError('');};
 const join=()=>{if(!records[selected+1])return;setRecords(records.flatMap((r,i)=>i===selected?[{...r,end:records[i+1].end,confirmed:false}]:i===selected+1?[]:[r]));};
 const valid=record&&(record.institution.state==='unassigned'?!record.institution.name.trim():!!record.institution.name.trim())&&record.include.length>0;
 return <section className="card"><h3>Compiled-review mapping · version {preview.nextVersion}</h3><p>Corpus → Individual Review → Analysis Units. Institution is optional review metadata. All source components remain preserved; the selected components determine the text segmented for MCF analysis.</p>
 <p>{preview.candidates.length} detected candidates · {preview.candidates.filter(c=>c.confidence==='high').length} high-confidence boundaries · {preview.candidates.filter(c=>c.confidence!=='high').length} require boundary review. These are structural assessments, not machine classifications.</p>
 {preview.warnings.map(w=><p className="mcf-callout" key={w}>{w.replaceAll('_',' ')}</p>)}
 <p>Profile: {preview.profile.id} v{preview.profile.version}. Existing mappings, records and sessions remain available. New sessions use this mapping once confirmed.</p>
 <label>Reason for this mapping version<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></label>
 <label>Candidate review<select aria-label="Compiled review candidate" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{records.map((r,i)=><option key={i} value={i}>{i+1}. Blocks {r.start+1}–{r.end} · {r.confirmed?'Confirmed':'Pending'}</option>)}</select></label>
 {record&&<><p>{metadata?`${metadata.confidence} · Source review number: ${metadata.originalReviewNumber??'Not supplied'}`:'Researcher-adjusted boundary — inspect all components.'}</p>
 {metadata&&<details><summary>Extracted raw metadata and warnings</summary><pre>{JSON.stringify(metadata,null,2)}</pre></details>}
 <div className="form-grid"><label>Institution assignment<select value={record.institution.state} onChange={e=>update({institution:{...record.institution,state:e.target.value,...(e.target.value==='unassigned'?{name:''}:{})}})}><option value="unassigned">Unassigned</option><option value="proposed">Proposed / unconfirmed</option><option value="confirmed">Confirmed</option></select></label><label>Institution name<input disabled={record.institution.state==='unassigned'} value={record.institution.name} maxLength={500} onChange={e=>update({institution:{...record.institution,name:e.target.value}})}/></label></div>
 <label>Institution evidence / researcher note<textarea value={record.institution.note} maxLength={2000} onChange={e=>update({institution:{...record.institution,note:e.target.value}})}/></label>
 <fieldset><legend>Source components to include in MCF analysis for this review</legend>{['narrative','questionnaire','heading','editorial'].map(component=><label className="checkbox" key={component}><input type="checkbox" checked={record.include.includes(component)} onChange={e=>update({include:e.target.checked?[...record.include,component]:record.include.filter(c=>c!==component)})}/>{component}</label>)}</fieldset>
 <p>Default: narrative only. Questionnaire values are source responses, not MCF scores. Headings and editorial notes remain metadata unless explicitly selected. “Comments:” is a structural marker.</p>
 <details open><summary>All source blocks in this review</summary><div className="mcf-source">{blocks.map(b=><div key={b.index}><strong>Block {b.index+1} · {b.component} · {b.kind}</strong><pre style={{whiteSpace:'pre-wrap'}}>{b.text||'[Empty block]'}</pre></div>)}</div></details>
 <label>Split before block<select value={split} onChange={e=>setSplit(Number(e.target.value))}><option value={0}>Select boundary</option>{blocks.slice(1).map(b=><option key={b.index} value={b.index}>{b.index+1} · {b.component} · {b.text.slice(0,75)}</option>)}</select></label><button disabled={busy||!split} onClick={splitRecord}>Split review candidate</button><button disabled={busy||selected===records.length-1} onClick={join}>Join next candidate</button>
 <label>Boundary / metadata decision notes<textarea value={record.notes} maxLength={5000} onChange={e=>update({notes:e.target.value})}/></label>
 <button disabled={busy||!valid} onClick={confirm}>Confirm this candidate</button><button disabled={!selected} onClick={()=>setSelected(selected-1)}>Previous candidate</button><button disabled={selected===records.length-1} onClick={()=>setSelected(selected+1)}>Next candidate</button></>}
 <p>{records.filter(r=>r.confirmed).length}/{records.length} candidates confirmed. Unassigned institutions do not prevent confirmation.</p>
 <button disabled={busy} onClick={()=>setRecords(records.map(r=>preview.candidates.some(c=>c.confidence==='high'&&c.start===r.start&&c.end===r.end)&&r.include.length&&(r.institution.state==='unassigned'?!r.institution.name.trim():!!r.institution.name.trim())?{...r,confirmed:true}:r))}>Accept remaining high-confidence boundaries with current metadata and component selections</button>
 {error&&<p role="alert">{error}</p>}
 <button className="primary" disabled={busy||!reason.trim()||!records.length||records.some(r=>!r.confirmed)} onClick={()=>save({structural:{profile:`${preview.profile.id}@${preview.profile.version}`,hash:preview.hash,previousMappingId:preview.previousMappingId,reason,records}})}>Confirm mapping version and create review records</button><button disabled={busy} onClick={close}>Close structural preview</button>
 </section>;
}
