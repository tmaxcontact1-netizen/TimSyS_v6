import React,{useEffect,useRef,useState} from 'react';
import {adaptConnections} from './connections.ts';
export function useDocumentedConnections(model,statement,reader) {
  const [result,setResult]=useState(null),cache=useRef(new Map());
  const key=statement?`${model.revision}/${statement.id}`:'';
  useEffect(()=>{
    if(!statement)return;
    if(cache.current.has(key)){setResult(cache.current.get(key));return;}
    const controller=new AbortController(),container=model.containers.find(c=>c.id===statement.containerId);
    reader(`/collections/${encodeURIComponent(model.id)}/connections/${encodeURIComponent(container.source.documentId)}/${encodeURIComponent(statement.passageId)}?revision=${encodeURIComponent(model.revision)}`,controller.signal)
      .then(data=>{
        if(controller.signal.aborted)return;
        if(data.revision!==model.revision||!Array.isArray(data.records))throw Error('The documentary connection projection is unavailable or out of date.');
        const value={key,...adaptConnections(model,statement,data.records)};
        cache.current.set(key,value);setResult(value);
      }).catch(error=>{if(error.name!=='AbortError')setResult({key,error:error.message,connections:[],rejected:[]});});
    return()=>controller.abort();
  },[key,model,reader]);
  return result?.key===key?result:{connections:[],rejected:[],loading:Boolean(statement)};
}
export function ConnectionPortals({connections,onFollow,onInspect}) {
  return <section className="dl-portals" aria-label="Documentary destinations">
    <small>Documented destinations · navigation only</small>
    <div>{connections.slice(0,3).map(r=><button key={r.id} data-connection-id={r.id} onClick={()=>r.destinationId?onFollow(r):onInspect(r.id)}>
      <span>{r.phrase}</span><strong>{r.counterpart}</strong><small>{r.destinationId?'Go to existing source':'Inspect referenced counterpart'}</small>
    </button>)}</div>
    {connections.length>3&&<small>First 3 of {connections.length} in source order. All connections are available in the inspector.</small>}
  </section>;
}
export function ConnectionInspector({connections,selectedId,onInspect,onFollow,onSource,page=0,onPage}) {
  const evidence=useRef(null);
  const selected=connections.find(r=>r.id===selectedId);
  useEffect(()=>{
    const element=evidence.current,dock=element?.closest('.dl-inspector');
    if(selected&&dock) {
      // Reveal evidence inside the dock only; do not scroll the landscape or page away.
      dock.scrollTop+=element.getBoundingClientRect().top-dock.getBoundingClientRect().top-16;
    }
  },[selectedId]);
  return <section className="dl-connections" aria-label="Documented connections">
    <h3>Documented connections</h3>
    <p>Literal source wording. Navigation does not imply authority, dependency or sequence.</p>
    {selected&&<section ref={evidence} className="dl-connection-evidence" aria-label="Connection evidence">
      <h3>Why is this connection here?</h3>
      <dl><dt>Exact relationship phrase</dt><dd>{selected.phrase}</dd>
        <dt>Origin source</dt><dd>{selected.evidence.sourceRole}</dd>
        <dt>Documented actor</dt><dd>{selected.evidence.actor}</dd>
        <dt>Counterpart wording</dt><dd>{selected.counterpart}</dd>
        <dt>Source document</dt><dd>{selected.evidence.sourceDocument}</dd>
        <dt>Source location</dt><dd>{selected.evidence.sourceLocation}</dd>
        <dt>Destination</dt><dd>{selected.resolution}</dd>
        {selected.object&&<><dt>Object</dt><dd>{selected.object}</dd></>}
        {selected.purpose&&<><dt>Purpose/context</dt><dd>{selected.purpose}</dd></>}
        {selected.condition&&<><dt>Condition</dt><dd>{selected.condition}</dd></>}
      </dl>
      <p>Exact source sentence</p><blockquote>{selected.evidence.fullSourceSentence}</blockquote>
      {selected.evidence.fullSourcePassage!==selected.evidence.fullSourceSentence&&<><p>Full source passage</p><blockquote>{selected.evidence.fullSourcePassage}</blockquote></>}
      <button onClick={onSource}>View Source</button>
    </section>}
    <ul>{connections.slice(page*8,page*8+8).map(r=><li key={r.id} data-connection-id={r.id}>
      <button className="dl-connection-inspect" aria-pressed={r.id===selectedId} onClick={()=>onInspect(r.id)}>
        <strong>{r.phrase}</strong><span>{r.counterpart}</span><small>Inspect evidence</small>
      </button>
      {r.object&&<p>Object: {r.object}</p>}
      {r.purpose&&<p>Purpose/context: {r.purpose}</p>}
      {r.condition&&<p>Condition: {r.condition}</p>}
      {r.destinationId?<button onClick={()=>onFollow(r)}>Go to {r.counterpart}</button>:<p className="dl-referenced">Referenced counterpart — {r.resolution.toLowerCase()}.</p>}
    </li>)}</ul>
    {connections.length>8&&<div className="dl-connection-pages"><button disabled={!page} onClick={()=>onPage(page-1)}>Previous connections</button><span>{page+1} / {Math.ceil(connections.length/8)}</span><button disabled={(page+1)*8>=connections.length} onClick={()=>onPage(page+1)}>Next connections</button></div>}

  </section>;
}
