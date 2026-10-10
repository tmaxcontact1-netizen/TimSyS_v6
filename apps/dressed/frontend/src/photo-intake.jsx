import React, {useEffect,useRef,useState} from "react";

const options={
 primaryColour:["unknown","black","white","grey","navy","blue","brown","beige","red","burgundy","green","yellow","orange","purple","pink"],
 lightness:["unknown","dark","medium","light"],saturation:["unknown","muted","medium","vivid"],
 pattern:["unknown","solid","striped","checked","patterned"],texture:["unknown","smooth","textured"],
};
const labels={primaryColour:"Primary colour",secondaryColour:"Secondary colour",lightness:"Lightness",saturation:"Colour intensity",pattern:"Pattern",texture:"Texture"};
const emptyAppearance={primaryColour:"unknown",secondaryColour:null,lightness:"unknown",saturation:"unknown",pattern:"unknown",texture:"unknown"};
const title=value=>value==="unknown"?"Unknown / unsure":value.charAt(0).toUpperCase()+value.slice(1);
const message=error=>({review_version_conflict:"This garment changed. Close and reopen the review before saving your corrections.",review_analysis_stale:"A photograph changed after this analysis. Analyse the current photograph again, or choose manual entry.",image_not_current:"That photograph was replaced. Select the current photograph."}[error.message]||error.message);

export default function PhotoIntake({garment,categories,uses,api,close,saved}){
 const [record,setRecord]=useState(garment),[photos,setPhotos]=useState([]),[selected,setSelected]=useState(null),[role,setRole]=useState("whole");
 const [analysis,setAnalysis]=useState(null),[previous,setPrevious]=useState(null),[crop,setCrop]=useState(null),[draft,setDraft]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[manual,setManual]=useState(false),[dirty,setDirty]=useState(new Set());
 const fileInput=useRef(null),drag=useRef(null),hasReview=useRef(false),dirtyRef=useRef(new Set());
 const active=photos.find(p=>p.id===selected);
 const change=(key,value)=>{dirtyRef.current.add(key);setDirty(new Set(dirtyRef.current));setDraft(d=>({...d,[key]:value}));};
 const changeAppearance=(key,value)=>{dirtyRef.current.add(key);setDirty(new Set(dirtyRef.current));setDraft(d=>({...d,appearance:{...d.appearance,[key]:value}}));};
 const toggle=(key,value)=>change(key,draft[key].includes(value)?draft[key].filter(x=>x!==value):[...draft[key],value]);
 async function refresh(initial=false){
  const [latest,imageState,state]=await Promise.all([api(`/api/garments/${garment.id}`),api(`/api/garments/${garment.id}/images`),api(`/api/garments/${garment.id}/intake`)]);
  setRecord(latest);setPhotos(imageState.items);setPrevious(state.review);hasReview.current=Boolean(state.review);
  if(initial){
   const image=imageState.items.find(x=>x.isCurrent&&x.role==="whole")||imageState.items.find(x=>x.isCurrent&&x.role==="detail");setSelected(image?.id??null);
   const currentIds=imageState.items.filter(x=>x.isCurrent&&["whole","detail"].includes(x.role)).map(x=>x.id).sort();
   const latestAnalysis=state.analysis&&JSON.stringify([...state.analysis.source_image_ids].sort())===JSON.stringify(currentIds)?state.analysis:null;
   setAnalysis(latestAnalysis);setCrop(latestAnalysis?.crops?.crop??null);
   setDraft({name:latest.name,categoryId:latest.categoryId,formality:latest.formality??"",seasons:latest.seasons,useIds:latest.uses.map(x=>x.id),appearance:state.review?.values.appearance??latestAnalysis?.result.appearance??{...emptyAppearance}});
  }
  return latest;
 }
 useEffect(()=>{void refresh(true).catch(e=>setError(message(e)));},[garment.id]);
 function applyDetection(result,explicit=false){
  if(explicit){for(const key of Object.keys(result.appearance))dirtyRef.current.add(key);setDirty(new Set(dirtyRef.current));}
  setDraft(d=>{
   if(!d)return d;
   const appearance={...d.appearance};
   for(const [key,value] of Object.entries(result.appearance))if(explicit||(!hasReview.current&&!dirtyRef.current.has(key)))appearance[key]=value;
   const suggestion=categories.find(x=>x.slug===result.suggestedCategory);
   const existing=categories.find(x=>x.id===d.categoryId);
   return {...d,appearance,categoryId:suggestion&&(explicit||(!hasReview.current&&!dirtyRef.current.has("categoryId")&&existing?.slug==="uncategorised"))?suggestion.id:d.categoryId};
  });
 }
 async function detect(imageId=selected,selection=crop){
  setError("");setNotice("");setBusy(true);
  try{const result=await api(`/api/garments/${garment.id}/intake/analyse`,{method:"POST",body:JSON.stringify({imageId,crop:selection})});setAnalysis(result);setManual(false);applyDetection(result.result);setNotice(hasReview.current?"New suggestions are available. Your confirmed choices have been kept.":"Detection finished. Check or edit every suggested detail below.");}
  catch(e){setError(message(e));setManual(true);}
  finally{setBusy(false);}
 }
 async function upload(event){
  const file=event.target.files?.[0];if(!file)return;setBusy(true);setError("");setNotice("");
  try{
   const query=new URLSearchParams({role,filename:file.name});
   const response=await fetch(`/api/garments/${garment.id}/images?${query}`,{method:"POST",headers:{"content-type":file.type||"application/octet-stream"},body:file});
   const result=await response.json();if(!response.ok)throw Error(result.error==="unsupported_or_invalid_image"?"This image could not be decoded. Choose a JPEG or PNG, or continue with manual details.":result.error);
   await refresh();setSelected(result.image.id);setCrop(null);setAnalysis(null);
   await detect(result.image.id,null);
  }catch(e){setError(message(e));setManual(true);}finally{setBusy(false);if(fileInput.current)fileInput.current.value="";}
 }
 async function submit(event){
  event.preventDefault();setBusy(true);setError("");
  try{
   await api(`/api/garments/${garment.id}/intake/review`,{method:"POST",body:JSON.stringify({...draft,version:record.version,analysisId:manual?null:analysis?.id??null,formality:draft.formality===""?null:Number(draft.formality)})});
   await refresh();dirtyRef.current.clear();setDirty(new Set());setNotice("Review saved. Confirmed choices will be kept when you analyse another photograph.");await saved?.();
  }catch(e){setError(message(e));}finally{setBusy(false);}
 }
 function point(event){const bounds=event.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))};}
 function begin(event){if(busy)return;event.preventDefault();drag.current=point(event);event.currentTarget.setPointerCapture(event.pointerId);}
 function move(event){if(!drag.current)return;const end=point(event),start=drag.current;setCrop({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.max(.001,Math.abs(end.x-start.x)),height:Math.max(.001,Math.abs(end.y-start.y))});}
 function end(){drag.current=null;}
 function cropValue(key,value){const next={...(crop??{x:0,y:0,width:1,height:1}),[key]:Math.max(0,Math.min(100,Number(value)))/100};next.width=Math.max(.001,Math.min(next.width,1-next.x));next.height=Math.max(.001,Math.min(next.height,1-next.y));next.x=Math.min(next.x,.999);next.y=Math.min(next.y,.999);setCrop(next);}
 const shown=crop??analysis?.result.region;
 const leaves=categories.filter(x=>!categories.some(child=>child.parentCategoryId===x.id));
 const status=key=>dirty.has(key)?"Changed in this draft — check before saving":draft?.appearance[key]==="unknown"?"Undetected — choose or leave uncertain":previous?"Previously confirmed":!analysis?"Enter your judgement":"Suggested — check against the garment";
 return <div className="modal-backdrop"><section className="modal intake-modal" role="dialog" aria-modal="true" aria-labelledby="intake-title">
  <header><div><p className="eyebrow">UPLOAD · DETECT · REVIEW</p><h2 id="intake-title">Photographs and garment details</h2><p>Keep the original. Select the garment here, then confirm or correct the suggestions. No colour card required.</p></div><button className="quiet" disabled={busy} onClick={close}>Close</button></header>
  {error&&<p className="error banner" role="alert">{error}</p>}{notice&&<p className="success banner" role="status">{notice}</p>}
  <div className="intake-columns"><section aria-label="Photograph selection">
   <label>Photograph type<select value={role} onChange={e=>setRole(e.target.value)} disabled={busy}><option value="whole">Whole garment</option><option value="detail">Detail / close-up (optional)</option></select></label>
   <label className="intake-upload">Upload original photograph<input ref={fileInput} type="file" accept="image/jpeg,image/png" disabled={busy} onChange={upload}/></label>
   <p className="muted">Use even light and avoid filters or glare. Cropping happens below after upload.</p>
   {photos.some(p=>p.isCurrent)&&<label>Current photograph<select value={selected??""} disabled={busy} onChange={e=>{setSelected(e.target.value);setCrop(null);setAnalysis(null);setManual(true);}}>{photos.filter(p=>p.isCurrent).map(p=><option key={p.id} value={p.id}>{p.role} — {p.originalFilename}</option>)}</select></label>}
   {active&&<>
    <div className="intake-photo"><img src={`/api/images/${active.id}/content`} alt={`Original photograph of ${record.name}`}/><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Drag to select the garment area" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>{shown&&<rect x={shown.x*100} y={shown.y*100} width={shown.width*100} height={shown.height*100} fill="none" stroke={crop?"#f0c674":"#74dfbd"} strokeWidth="0.6" strokeDasharray={crop?undefined:"2 1"}/>}</svg></div>
    <p className="muted">{crop?"Your selection":"Dashed outline: estimated garment area"}. Drag a rectangle or adjust the percentages below, then select Detect from selected area to update suggestions. The original stays unchanged.</p>
    <div className="intake-crop-controls">{["x","y","width","height"].map(key=><label key={key}>{({x:"Left",y:"Top",width:"Width",height:"Height"})[key]} %<input aria-label={`Selection ${key} percent`} type="number" min={key==="x"||key==="y"?0:.1} max={100} step="0.1" disabled={busy} value={Math.round((crop??{x:0,y:0,width:1,height:1})[key]*1000)/10} onChange={e=>cropValue(key,e.target.value)}/></label>)}</div>
    <div className="row-actions"><button type="button" disabled={busy} onClick={()=>void detect()}>{busy?"Analysing…":"Detect from selected area"}</button><button type="button" disabled={busy} onClick={()=>{setCrop(null);void detect(selected,null);}}>Detect area automatically</button></div>
   </>}
   {!active&&<p className="empty">Upload a photograph to detect the garment, or enter the details manually.</p>}
   <button type="button" disabled={busy} onClick={()=>{setManual(true);setNotice("Manual entry selected. All fields below can be completed without successful detection.");}}>Enter details manually</button>
   {photos.filter(p=>!p.isCurrent).length>0&&<details><summary>Previous originals</summary>{photos.filter(p=>!p.isCurrent).map(p=><a key={p.id} href={`/api/images/${p.id}/content`} target="_blank" rel="noreferrer">{p.originalFilename} ({p.role})</a>)}</details>}
  </section><section aria-label="Review detected details">
   <h3>Review and correct</h3><p>All fields below are editable. Leave a field unknown when you are unsure; outfit suggestions will show that uncertainty.</p>
   {analysis&&<div className="intake-findings" role="status"><strong>Detection notes</strong><ul>{analysis.result.findings.map(text=><li key={text}>{text}</li>)}</ul>{previous&&<button type="button" disabled={busy} onClick={()=>applyDetection(analysis.result,true)}>Use new appearance suggestions in this draft</button>}</div>}
   {previous&&!previous.is_current&&<p className="intake-findings">The photograph changed. Previous choices are retained below; confirm this review before using the garment in new outfits.</p>}
   {draft&&<form onSubmit={submit}><fieldset disabled={busy}><div className="form-grid">
    <label>Name<input required maxLength={120} value={draft.name} onChange={e=>change("name",e.target.value)}/></label>
    <label>Category<select required value={draft.categoryId} onChange={e=>change("categoryId",e.target.value)}>{leaves.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><small>Check manually; shape alone cannot identify garment type reliably.</small></label>
    <label>Formality<select value={draft.formality} onChange={e=>change("formality",e.target.value)}><option value="">Unknown / unsure</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} — {['Casual','Relaxed','Smart casual','Business','Formal'][n-1]}</option>)}</select><small>Enter your judgement; not inferred from colour.</small></label>
    {Object.entries(labels).map(([key,label])=><label key={key}>{label}<select value={draft.appearance[key]??"none"} onChange={e=>changeAppearance(key,e.target.value==="none"?null:e.target.value)}>{key==="secondaryColour"&&<option value="none">None</option>}{(options[key]??options.primaryColour).map(value=><option key={value} value={value}>{title(value)}</option>)}</select><small>{status(key)}</small></label>)}
   </div>
   <fieldset className="intake-checks"><legend>Use — select every applicable use</legend>{uses.map(use=><label key={use.id}><input type="checkbox" checked={draft.useIds.includes(use.id)} onChange={()=>toggle("useIds",use.id)}/>{use.name}</label>)}</fieldset>
   <fieldset className="intake-checks"><legend>Seasons — leave blank if unsure</legend>{["spring","summer","autumn","winter","all-season"].map(season=><label key={season}><input type="checkbox" checked={draft.seasons.includes(season)} onChange={()=>toggle("seasons",season)}/>{title(season)}</label>)}</fieldset>
   <div className="intake-findings"><strong>Before saving</strong><ul>
    <li>Colours remain approximate; confirming a family does not calibrate the photograph.</li>
    {Object.entries(draft.appearance).filter(([,v])=>v==="unknown").map(([key])=><li key={key}>{labels[key]} is uncertain and will be flagged in outfit suggestions.</li>)}
    {draft.formality===""&&<li>Formality is unknown; context suitability will be flagged.</li>}
    {!draft.seasons.length&&<li>Season suitability is unknown.</li>}
    {!draft.useIds.length&&<li>Select a use to include this garment in outfit generation.</li>}
    {categories.find(c=>c.id===draft.categoryId)?.slug==="uncategorised"&&<li>Choose a garment category before generating outfits.</li>}
   </ul></div>
   <button className="primary" type="submit">{busy?"Working…":"Confirm and save review"}</button>
   <p className="muted">Brand, size, materials and purchase information remain available under Edit garment. This review preserves them.</p>
   </fieldset></form>}
  </section></div>
 </section></div>;
}
