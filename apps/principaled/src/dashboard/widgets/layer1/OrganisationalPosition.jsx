import React from 'react';
import {title} from './model.mjs';
import {handoffState} from './selected-context.mjs';
export default function OrganisationalPosition({context,model,onGap,onEdge,onSelect,onFamily,onSource,compact=false,detailsOnly=false}){
 if(!context)return null;
 const {responsibility:n,relationships,handoffs,family}=context;
 return <section className={`l1-position ${compact?'compact':''}`} aria-label="Organisational position" data-responsibility={n.id}>
  {!detailsOnly&&<><h3>{n.id} — {title(n)}</h3>
  <p>{model.label(n.data.role_id)} · {(n.data.domain_ids||[]).filter(id=>!model.references.get(id)?.data.parent_id).map(model.label).join(', ')} · {n.data.level_id?model.label(n.data.level_id):n.data.level||'Level unknown'}</p></>}
  <div className="l1-consequences">
   {relationships.map(({edge:e,other,direction})=><article key={e.id} data-connection={e.id}><strong>{direction==='symmetric'?'↔':direction==='outgoing'?'→':'←'} {model.label(e.data.relationship_type_id)}</strong><p>{direction==='incoming'?'From':direction==='outgoing'?'To':'With'} {model.label(other.data.role_id)} · <button onClick={()=>onSelect(other.id)}>{other.id} — {title(other)}</button></p><small>{e.data.evidence} · {e.data.review_status} · {direction}</small><button onClick={()=>onEdge(e.id)}>Inspect relationship {e.id}</button></article>)}
   {handoffs.map(g=><article key={g.id} data-handoff={g.id}><strong>{g.evidence==='documentary'?'Documentary':'Recorded'} handoff → {g.target_role_name}</strong><p>{handoffState(g)}</p><p>Trail stops here — receiving responsibility unresolved.</p><small>{g.evidence} · {g.review_status} · unresolved · {g.id}</small><button onClick={()=>onGap(g.id)}>Inspect handoff {g.id}</button></article>)}
   {!relationships.length&&!handoffs.length&&<p>No current mapped organisational relationship or unresolved handoff. {context.companions.length?'Documentary companions provide source context, not process sequence.':'No current governed responsibility connections are mapped.'}</p>}
  </div>
  {!detailsOnly&&<div className="l1-position-evidence"><button onClick={onSource}>View source statement · {context.statementId||'unknown'}</button><button onClick={onFamily}>Show documentary family · {family.length}</button><small>Evidence: {n.data.evidence||'unknown'} · Review: {n.data.review_status} · Documentary co-specification does not establish sequence.</small></div>}
 </section>;
}
