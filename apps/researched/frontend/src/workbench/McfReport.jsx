import React,{useState} from 'react';
import {summariseMcf} from './mcf-report.js';
import {CodeEditor} from './Review.jsx';
import {Pager} from './shared.jsx';

export function McfReport({session,instrument,draft,machine,change,readonly=false}){
 const [editing,setEditing]=useState(null),[open,setOpen]=useState(null);
 const report=summariseMcf(session,instrument,draft,machine);
 if(!session||!instrument)return <p>Preparing your analysis…</p>;
 const edit=report.findings.find(f=>f.unit.id===editing);
 function evidence(f,key){return <article className="wb-finding" key={key??f.unit.id}>
  <p className="wb-source-label">{f.unit.filename} · {f.unit.review_identifier??'Record'} · Passage {f.unit.session_ordinal} · {f.human?'Researcher edited':f.local?'Deterministic rule match':'AI finding'}</p>
  {f.code?<><p>{f.local?'Meaning not interpreted':f.code.evidenceStrength==='Explicit'?'Directly stated':'Interpreted from context'}{f.code.valence?' · '+f.code.valence.replaceAll('-',' '):''}</p><blockquote>{f.code.evidence}</blockquote><p>{f.code.rationale}</p></>:<blockquote>{f.unit.original_text}</blockquote>}
  {f.value.notes&&<p>{f.human?'Researcher note':f.local?'Rule limitation':'AI note'}: {f.value.notes}</p>}
  {!readonly&&<><button onClick={()=>setEditing(f.unit.id)}>Correct this passage</button>{f.human&&<button onClick={()=>{const decisions={...draft.decisions};delete decisions[f.unit.id];change({decisions},'Restored AI finding');}}>Undo my correction</button>}</>}
 </article>;}
 return <section aria-label="MCF competency report"><h3>Management competencies in your documents</h3>
  <p>All 21 competencies included. {report.analysed} of {report.total} passages analysed; {report.human} edited by you.</p>
  <p>{report.deterministic>0?`${report.deterministic} passages processed locally using deterministic rules. These are candidate matches; meaning, negation, explicit/implicit strength and valence have not been assessed.`:"AI findings identify directly stated and contextual evidence."} Checking every passage is optional.</p>
  {report.missing.length>0&&<p className="wb-warning">{report.missing.length} passages have no result yet. This report is incomplete; missing results do not mean that competencies are absent.</p>}
  {(draft.machineReport?.limitations??[]).map((text,i)=><p className="wb-muted" key={i}>Limitation: {text}</p>)}
  <details><summary>Context-dependent or mixed findings ({report.contextual.length} passages)</summary><p>These are useful places to spot-check. This grouping is not a calibrated confidence score.</p><Pager items={report.contextual} render={items=>items.map(f=>evidence(f))}/></details>
  {instrument.domains.filter(domain=>report.competencies.some(c=>c.domainId===domain.id&&c.findings.length)).map(domain=><section key={domain.id}><h3>{domain.name}</h3>{report.competencies.filter(c=>c.domainId===domain.id&&c.findings.length).map(c=><section className="wb-finding" key={c.id}><h4>{c.competency}</h4>{c.findings.length?<><p>{c.findings[0].code.rationale}</p><blockquote>{c.findings[0].code.evidence}</blockquote><small>Example evidence · {c.findings[0].unit.filename} · Passage {c.findings[0].unit.session_ordinal}</small><p>{c.findings.length} matched passages · {c.findings.filter(f=>f.local).length} local rule matches · {c.findings.filter(f=>f.code.evidenceStrength==='Explicit').length} directly stated · {c.findings.filter(f=>f.code.evidenceStrength==='Implicit').length} from context</p><button aria-expanded={open===c.id} onClick={()=>setOpen(open===c.id?null:c.id)}>{open===c.id?'Hide':'Read'} evidence for {c.competency}</button>{open===c.id&&<Pager items={c.findings} render={items=>items.map(f=>evidence(f))}/>}</>:<p>No supporting evidence identified in the analysed passages. This is not a documentary representation score.</p>}</section>)}</section>)}
  <details><summary>No matches identified ({report.competencies.filter(c=>!c.findings.length).length} competencies)</summary><p>No match does not mean absence. Rule matching can miss relevant wording and cannot infer context. This is not a documentary representation score.</p><ul>{report.competencies.filter(c=>!c.findings.length).map(c=><li key={c.id}>{c.competency}</li>)}</ul></details>
  <details><summary>Passages with no matches ({report.noCode.length})</summary><Pager items={report.noCode} render={items=>items.map(f=>evidence(f))}/></details>
  {edit&&!readonly&&<div className="wb-overlay"><section role="dialog" aria-modal="true" aria-label="Correct passage"><h3>Correct this passage</h3><blockquote>{edit.unit.original_text}</blockquote><CodeEditor key={editing} value={{codes:edit.value.codes.map(c=>({competencyId:c.competencyId,evidence:c.evidence,rationale:c.rationale,evidenceStrength:c.evidenceStrength??'Explicit',valence:c.valence})),valence:edit.value.valence,notes:edit.value.notes,reviewedNoCode:edit.value.reviewedNoCode}} unit={edit.unit} instrument={instrument} documentary={session.mode==='documentary'} save={value=>{change({decisions:{...draft.decisions,[editing]:value}},'Corrected AI finding');setEditing(null);}} cancel={()=>setEditing(null)}/></section></div>}
 </section>;
}
