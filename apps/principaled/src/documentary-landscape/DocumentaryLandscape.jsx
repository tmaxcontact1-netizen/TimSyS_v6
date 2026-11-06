import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ancestors,detailLevel,home,layout,visible,sectionPresentation,statementLabel,reframe,closeInspector} from './model.ts';
import {readDocumentary} from './read';
import './landscape.css';
import {useDocumentedConnections,ConnectionPortals,ConnectionInspector} from './DocumentedConnections';

const short=text=>text.length>100?text.slice(0,100)+'…':text;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export default function DocumentaryLandscape({model,sourceReader=readDocumentary}) {
  const [frame,setFrame]=useState(home),[history,setHistory]=useState([]);
  const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0);
  const [matches,setMatches]=useState([]),[searchReady,setSearchReady]=useState(false),[searchError,setSearchError]=useState('');
  const [size,setSize]=useState({width:1000,height:600}),[source,setSource]=useState(null),[sourceError,setSourceError]=useState('');
  const viewport=useRef(null),workspace=useRef(null),sourceContext=useRef(null),drag=useRef(null),moved=useRef(false),worker=useRef(null),latestSearch=useRef(''),zoomHandler=useRef(null),initialView=useRef(false),selectionTimer=useRef(null);
  const {context,camera,selection:selected}=frame;
  const containers=useMemo(()=>new Map(model.containers.map(c=>[c.id,c])),[model]);
  const matchIds=useMemo(()=>new Set(matches.flatMap(s=>[s.id,s.sectionId,s.containerId])),[matches]);
  const tiles=useMemo(()=>layout(model,context),[model,context.containerId,context.sectionId]);
  const shown=visible(tiles,camera,size.width,size.height);
  const container=containers.get(context.containerId),section=model.sections.get(context.sectionId),statement=model.statements.get(context.statementId);
  const title=id=>containers.get(id)?.title||(model.sections.has(id)?sectionPresentation(model,model.sections.get(id)).title:null)||model.statements.get(id)?.text||'';
  const selectedStatement=model.statements.get(selected),selectedSection=model.sections.get(selected)||model.sections.get(selectedStatement?.sectionId);
  const selectedContainer=containers.get(selected)||containers.get(selectedSection?.containerId);
  const inspectorVisible=Boolean(frame.inspectorOpen&&selectedContainer);
  const relationshipState=useDocumentedConnections(model,inspectorVisible?selectedStatement:null,sourceReader);
  const activeConnections=frame.connectionsOpen&&inspectorVisible&&selectedStatement?relationshipState.connections:[];
  const selectedLabel=selectedStatement?statementLabel(selectedContainer,selectedStatement,selectedSection):
    selectedSection?sectionPresentation(model,selectedSection).label:selectedContainer?.labels.container;
  const close=()=>{
    clearTimeout(selectionTimer.current);
    setFrame(f=>closeInspector(f));
    // Return keyboard focus to the landscape without moving its scroll position.
    viewport.current?.focus({preventScroll:true});
  };
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query);setPage(0);},120);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>()=>clearTimeout(selectionTimer.current),[]);
  useEffect(()=>{
    const task=new Worker(new URL('./search-worker.ts',import.meta.url),{type:'module'});worker.current=task;
    task.onmessage=({data})=>{
      if(data.ready)setSearchReady(true);
      if(data.error)setSearchError(data.error);
      if(data.query===latestSearch.current)setMatches(data.ids.map(id=>model.statements.get(id)));
    };
    task.onerror=()=>setSearchError('Document search is unavailable. Reload the collection to try again.');
    task.postMessage({model});return()=>{task.terminate();worker.current=null;};
  },[model]);
  useEffect(()=>{latestSearch.current=search;setMatches([]);worker.current?.postMessage({query:search});},[search]);
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>{
      const bounds={width:entry.contentRect.width,height:entry.contentRect.height};setSize(bounds);
      if(!initialView.current&&bounds.width){initialView.current=true;setFrame({context:{},camera:fitCamera({},bounds)});}
      else setFrame(f=>{
        if(!f.inspectorOpen||!f.selection)return f;
        const tile=layout(model,f.context).find(t=>t.id===f.selection);
        if(!tile)return f;
        const next=reframe(tile,f.camera,bounds.width,bounds.height);
        return same(next,f.camera)?f:{...f,camera:next};
      });
    });
    observer.observe(viewport.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const element=viewport.current;
    const wheel=e=>{e.preventDefault();e.stopPropagation();const rect=element.getBoundingClientRect();zoomHandler.current(e.deltaY<0?1.12:1/1.12,{x:e.clientX-rect.left,y:e.clientY-rect.top});};
    element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);
  },[]);
  useEffect(()=>{
    setSource(null);setSourceError('');if(!context.source||!statement||!container)return;
    const controller=new AbortController();
    sourceReader(`/collections/${encodeURIComponent(model.id)}/source/${encodeURIComponent(container.source.documentId)}/${encodeURIComponent(statement.passageId)}?revision=${encodeURIComponent(model.revision)}`,controller.signal)
      .then(data=>setSource(data.source)).catch(e=>{if(e.name!=='AbortError')setSourceError(e.message);});
    return()=>controller.abort();
  },[context.source,statement?.id,model.revision,sourceReader]);
  useEffect(()=>{
    const element=sourceContext.current,mark=element?.querySelector('mark');
    if(mark)element.scrollTop=Math.max(0,mark.offsetTop-element.clientHeight/3);
  },[source]);
  function fitCamera(next,bounds=size) {
    const all=layout(model,next);
    const width=bounds===size?(workspace.current?.clientWidth||bounds.width):bounds.width;
    if(!all.length||all.length>12||width<800)return home().camera;
    return {x:32,y:32,zoom:Math.min(1,(width-64)/Math.max(...all.map(t=>t.x+t.width)),(bounds.height-64)/Math.max(...all.map(t=>t.y+t.height)))};
  }
  function go(next,nextCamera=fitCamera(next)) {
    clearTimeout(selectionTimer.current);
    if(same(next,context)){
      if(next.statementId)setFrame(f=>({...f,selection:next.statementId,inspectorOpen:true,undockedCamera:f.undockedCamera||f.camera}));
      return;
    }
    setHistory(h=>[...h,frame]);
    const sameLandscape=next.containerId===context.containerId&&next.sectionId===context.sectionId;
    setFrame({context:next,camera:nextCamera,selection:next.statementId,inspectorOpen:Boolean(next.statementId),
      undockedCamera:next.statementId?(frame.inspectorOpen&&sameLandscape?frame.undockedCamera:nextCamera):undefined,
      arrival:frame.arrival,...(next.statementId&&next.statementId===context.statementId?{connectionsOpen:frame.connectionsOpen,connectionId:frame.connectionId,connectionPage:frame.connectionPage}:{})});
  }
  function followConnection(r) {
    clearTimeout(selectionTimer.current);
    const target=model.containers.find(c=>c.id===r.destinationId),tile=layout(model,{}).find(t=>t.id===r.destinationId);
    if(!target||!tile)return;
    const destinationCamera={x:32-tile.x,y:32-tile.y,zoom:1};
    setHistory(h=>[...h,frame]);
    setFrame({context:{},camera:destinationCamera,selection:target.id,inspectorOpen:true,undockedCamera:destinationCamera,
      arrival:{originId:selectedStatement.id,originTitle:selectedContainer.title,originText:selectedStatement.text,phrase:r.phrase,counterpart:r.counterpart,connectionId:r.id}});
  }
  const inspectConnection=id=>setFrame(f=>({...f,connectionId:id}));
  function back() {
    clearTimeout(selectionTimer.current);
    if(!history.length)return;
    setFrame(history[history.length-1]);setHistory(h=>h.slice(0,-1));
  }
  function reset(){clearTimeout(selectionTimer.current);setFrame({context:{},camera:fitCamera({})});setHistory([]);setQuery('');setSearch('');}
  function enter(id) {
    const c=containers.get(id),s=model.sections.get(id),p=model.statements.get(id);
    if(c)go({containerId:c.id});
    else if(s)go({containerId:s.containerId,sectionId:s.id});
    else if(p)go({containerId:p.containerId,sectionId:p.sectionId,statementId:p.id},camera);
  }
  function jump(s) {
    const next={containerId:s.containerId,sectionId:s.sectionId,statementId:s.id};
    const tile=layout(model,next).find(t=>t.id===s.id);
    const targetCamera={x:32-tile.x,y:32-tile.y,zoom:1};
    // Back restores where the user actually searched from, not fabricated ancestor visits.
    go(next,targetCamera);
  }
  function zoomBy(factor,point={x:size.width/2,y:size.height/2}) {
    const z=Math.min(2.2,Math.max(.35,camera.zoom*factor));
    const next={x:point.x-(point.x-camera.x)*z/camera.zoom,y:point.y-(point.y-camera.y)*z/camera.zoom,zoom:z};
    if(z>=1.85&&!context.statementId) {
      const focus=tiles.find(t=>t.id===selected)||shown.reduce((best,t)=>{
        const distance=t=>Math.hypot((t.x+t.width/2)*camera.zoom+camera.x-point.x,(t.y+t.height/2)*camera.zoom+camera.y-point.y);
        return !best||distance(t)<distance(best)?t:best;
      },null);
      if(focus){enter(focus.id);return;}
    }
    if(z<=.48&&context.containerId){if(history.length)back();else go({});return;}
    setFrame(f=>({...f,camera:next}));
  }
  function select(id) {
    if(moved.current)return;
    if(model.statements.has(id)){enter(id);return;}
    const tile=tiles.find(t=>t.id===id);
    setFrame(f=>({...f,selection:id,inspectorOpen:true,undockedCamera:f.inspectorOpen?f.undockedCamera:f.camera,
      camera:f.inspectorOpen&&tile?reframe(tile,f.camera,size.width,size.height):f.camera}));
  }
  zoomHandler.current=zoomBy;
  const crumbs=ancestors(context);
  const crumbLabel=(c,i)=>i===0?'Organisation':c.statementId?short(title(c.statementId)):title(c.sectionId||c.containerId);
  const activeLabel=section?container.labels.statement:container?container.labels.section:'Documentary objects';
  return <div className="dl">
    <header className="dl-header"><div><p className="dl-eyebrow">DOCUMENTARY LANDSCAPE · READ ONLY</p><h1>Nervous Breakdown</h1>
      <p>Find a place in the documents. Follow it back to the source.</p></div><span className="dl-pill">Phase 1 · Source navigation</span></header>
    <div className="dl-search"><label htmlFor="documentary-search">Search the documents</label>
      <input id="documentary-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try Career Week or assessment accommodations"/>
      {query&&<button onClick={()=>{setQuery('');setSearch('');}}>Clear search</button>}
    </div>
    {searchError?<p role="alert">{searchError}</p>:!searchReady&&<p role="status">Preparing document search… You can explore the landscape now.</p>}
    <nav className="dl-trail" aria-label="Documentary location">
      <button onClick={back} disabled={!history.length}>← Back</button><button onClick={reset}>Home</button>
      <ol>{crumbs.map((c,i)=><li key={i}><button title={crumbLabel(c,i)} aria-current={same(c,context)?'location':undefined} onClick={()=>go(c,c.statementId?camera:fitCamera(c))}>{crumbLabel(c,i)}</button></li>)}
      {context.source&&<li><button aria-current="location" onClick={()=>{}}>Source</button></li>}</ol>
    </nav>
    {frame.arrival&&<aside className="dl-arrival" aria-label="Arrived via">
      <small>Arrived via · documentary navigation</small><strong>{frame.arrival.originTitle}</strong>
      <span>{short(frame.arrival.originText)}</span><span>{frame.arrival.phrase} · {frame.arrival.counterpart}</span>
      <button onClick={back}>Back to previous location</button>
    </aside>}
    {search&&<section className="dl-results" aria-label="Search results">
      <div className="dl-result-heading"><strong>{matches.length} {matches.length===1?'match':'matches'}</strong><span>Original documentary locations are preserved.</span></div>
      {matches.slice(page*8,page*8+8).map(s=>{const c=containers.get(s.containerId);return <button key={s.id} onClick={()=>jump(s)}>
        <small>{c.source.documentType} · {c.source.filename}</small><strong>{c.title} → {title(s.sectionId)}</strong><span>{short(s.text)}</span>
      </button>;})}
      {matches.length>8&&<div><button disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous results</button><span> Page {page+1} of {Math.ceil(matches.length/8)} </span><button disabled={(page+1)*8>=matches.length} onClick={()=>setPage(p=>p+1)}>Next results</button></div>}
      {!matches.length&&<p>{searchReady?'No matching documentary text. Try a shorter phrase.':'Preparing search…'}</p>}
    </section>}
    <div ref={workspace} className={`dl-workspace ${inspectorVisible?'dl-with-inspector':''}`}>
      <section className="dl-stage" aria-label="Spatial documentary navigation">
        <div className="dl-stage-heading"><div><small>{section?sectionPresentation(model,section).label:container?container.labels.container:'Organisation'}</small><h2>{section?title(section.id):container?.title||'The documentary landscape'}</h2></div>
          <div className="dl-camera"><button aria-label="Zoom out" onClick={()=>zoomBy(1/1.3)}>−</button><span>{Math.round(camera.zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>zoomBy(1.3)}>+</button><button onClick={()=>setFrame(f=>({...f,camera:home().camera}))}>Reset view</button></div></div>
        <p className="dl-guidance">Select to inspect · Open or double-click to enter · Drag or use arrow keys to pan · Scroll to zoom</p>
        {activeConnections.length>0&&<ConnectionPortals connections={activeConnections} onFollow={followConnection} onInspect={inspectConnection}/>}
        <div className="dl-viewport" ref={viewport} tabIndex={0} aria-label={`${activeLabel} landscape`}
          onPointerDown={e=>{if(e.button!==0)return;moved.current=false;drag.current={x:e.clientX,y:e.clientY,camera};}}
          onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.hypot(dx,dy)>5){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);setFrame(f=>({...f,camera:{...drag.current.camera,x:drag.current.camera.x+dx,y:drag.current.camera.y+dy}}));}}}
          onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
          onKeyDown={e=>{if(e.target!==e.currentTarget)return;const steps={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]};
            if(steps[e.key]){e.preventDefault();const [x,y]=steps[e.key];setFrame(f=>({...f,camera:{...f.camera,x:f.camera.x+x,y:f.camera.y+y}}));}
            if(e.key==='Escape')back();}}>
          <div className={`dl-world ${drag.current?'dl-dragging':''}`} style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`}}>
            {shown.map(t=>{
              const c=containers.get(t.id),s=model.sections.get(t.id),p=model.statements.get(t.id);
              const preview=detailLevel(camera.zoom)==='preview';
              return <button key={t.id} data-object-id={t.id} data-address={`${t.x},${t.y}`} className={`dl-tile ${c?'dl-container':s?'dl-section':'dl-statement'} ${t.id===selected?'dl-selected':''} ${search&&!matchIds.has(t.id)?'dl-dim':''} ${search&&matchIds.has(t.id)?'dl-match':''}`}
                style={{left:t.x,top:t.y,width:t.width,height:t.height}} aria-label={title(t.id)} aria-pressed={t.id===selected}
                onClick={event=>{
                  clearTimeout(selectionTimer.current);
                  if(p||event.detail===0)select(t.id);
                  else {setFrame(f=>({...f,selection:t.id}));selectionTimer.current=setTimeout(()=>select(t.id),250);}
                }} onDoubleClick={()=>{clearTimeout(selectionTimer.current);if(!moved.current)enter(t.id);}}>
                <small>{c?c.source.documentType:s?sectionPresentation(model,s).label:statementLabel(container,p,section)}{search&&matchIds.has(t.id)?' · Search match':''}</small>
                <strong>{p?short(p.text):title(t.id)}</strong>
                {c&&<span className="dl-document-name">{c.source.filename}</span>}
                {preview&&c&&<span className="dl-preview">{c.sectionIds.slice(0,2).map(id=>title(id)).join(' · ')}{c.sectionIds.length>2?' …':''}</span>}
                {preview&&s&&<span className="dl-preview">{short(model.statements.get(s.statementIds[0])?.text||'')}</span>}
                {p&&<span className="dl-document-name">{p.location}</span>}
              </button>;
            })}
          </div>
          {!tiles.length&&<p className="dl-empty">No documentary statements in this location.</p>}
        </div>
        <footer className="dl-stage-footer"><span>Spatial positions aid navigation; they do not indicate authority or relationships.</span>
          {selected&&!inspectorVisible&&!model.statements.has(selected)&&<button className="dl-primary" onClick={()=>enter(selected)}>Open {short(title(selected))} →</button>}
        </footer>
      </section>
      {inspectorVisible&&<aside className="dl-inspector" aria-label="Source inspector">
        <div className="dl-inspector-top"><p className="dl-eyebrow">{selectedLabel}</p><button aria-label="Close inspector" onClick={close}>Close</button></div>
        {selectedStatement?<blockquote className="dl-selected-wording">{selectedStatement.text}</blockquote>:<h2>{title(selected)}</h2>}
        <section className="dl-inspector-context" aria-label="Documentary context"><h3>Context</h3>
          <dl>{selected!==selectedContainer.id&&<><dt>{selectedContainer.labels.container}</dt><dd>{selectedContainer.title}</dd></>}
          {selectedStatement&&<><dt>{sectionPresentation(model,selectedSection).label}</dt><dd>{title(selectedSection.id)}</dd></>}
          {selected===selectedContainer.id&&<><dt>Collection</dt><dd>{model.title}</dd></>}</dl>
        </section>
        <section className="dl-inspector-provenance" aria-label="Source provenance"><h3>Source</h3>
          <dl><dt>Document</dt><dd>{selectedContainer.source.filename}</dd>
          {selectedStatement&&<><dt>Location</dt><dd>{selectedStatement.location}</dd></>}
          <dt>Document type</dt><dd>{selectedContainer.source.documentType}</dd></dl>
        </section>
        {!selectedStatement?<button className="dl-primary" onClick={()=>enter(selected)}>Open {short(title(selected))} →</button>:
          !context.source?<button className="dl-primary" onClick={()=>go({...context,source:true},camera)}>View Source</button>:
          <section className="dl-source" aria-label="Source context"><h3>In the source</h3><p>The retained document text, with this passage highlighted.</p>
            {sourceError?<p role="alert">{sourceError}</p>:source?<pre ref={sourceContext} tabIndex={0} aria-label="Retained source text">{source.startTruncated?'…\n':''}{source.before}<mark>{source.text}</mark>{source.after}{source.endTruncated?'\n…':''}</pre>:<p role="status">Loading source context…</p>}
          </section>}
        {selectedStatement&&<div className="dl-connection-control">
          {relationshipState.loading?<p role="status">Checking documented connections…</p>:relationshipState.error?<p role="status">Documented connections unavailable: {relationshipState.error}</p>:
            relationshipState.connections.length?<button aria-expanded={Boolean(frame.connectionsOpen)} onClick={()=>setFrame(f=>({...f,connectionsOpen:!f.connectionsOpen,connectionId:undefined}))}>{frame.connectionsOpen?'Hide connections':'Show connections'}</button>:
            <p>No documented connections in this statement.</p>}
          {relationshipState.rejected.length>0&&<p role="alert">{relationshipState.rejected.length} connection record(s) could not be displayed because their documentary evidence did not match.</p>}
        </div>}
        {activeConnections.length>0&&<ConnectionInspector connections={activeConnections} selectedId={frame.connectionId} onInspect={inspectConnection} onFollow={followConnection} onSource={()=>go({...context,source:true},camera)} page={frame.connectionPage||0} onPage={connectionPage=>setFrame(f=>({...f,connectionPage}))}/>}
      </aside>}
    </div>
    <p className="dl-bottom">Read-only view of {model.title}. Documentary wording and structure are maintained in Research’Ed.</p>
  </div>;
}
