import {PersonalColouringAdvice,usePersonalColouring} from "./personal-colouring.jsx";
import { styleFor, slotFor, accessorySlots } from "../../src/domain/garment/visual-style.ts";
import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {mannequinMesh,renderMannequin} from './mannequin-renderer.js';

const supported=new Set(['top','base_layer','bottom','footwear','socks','belt','neckwear','pocket_square','waistcoat','jacket','outerwear',...accessorySlots]);
export default function OutfitPreview({garments,api}){
  const [open,setOpen]=useState(false),[items,setItems]=useState(null),[error,setError]=useState(''),[angle,setAngle]=useState(15),[zoom,setZoom]=useState(1);
  const {profile}=usePersonalColouring();
  const canvas=useRef(null),drag=useRef(null),region=useId();
  const key=garments.map(g=>g.id).join(':');
  useEffect(()=>{
    if(!open)return;let cancelled=false;setItems(null);setError('');
    Promise.all(garments.map(async g=>{
      const [state,record]=await Promise.all([api(`/api/garments/${g.id}/intake`),api(`/api/garments/${g.id}`)]);
      const full={...g,...record};
      return {...full,slotId:slotFor(full),style:styleFor(full)?.id,appearance:state.review?.values?.appearance||null,stale:state.review?.is_current===false};
    })).then(value=>{if(!cancelled)setItems(value);}).catch(()=>{if(!cancelled)setError('The garment details could not be loaded. Close and reopen the preview to try again.');});
    return()=>{cancelled=true;};
  },[open,key]);
  const mesh=useMemo(()=>items?mannequinMesh(items,profile?.mannequinColour):[],[items,profile?.mannequinColour]);
  useEffect(()=>{
    if(!open||!items||!canvas.current)return;
    const draw=()=>{if(!renderMannequin(canvas.current,mesh,angle,zoom))setError('The preview canvas is unavailable in this window. Your outfit and saved details are unchanged.');};
    draw();const observer=new ResizeObserver(draw);observer.observe(canvas.current);return()=>observer.disconnect();
  },[open,items,mesh,angle,zoom]);
  const rotate=value=>setAngle(((value+180)%360+360)%360-180);
  return <div className="outfit-preview">
    <PersonalColouringAdvice garments={garments} api={api}/>
    <button type="button" aria-expanded={open} aria-controls={region} onClick={()=>setOpen(v=>!v)}>{open?'Close 3D preview':'Preview outfit in 3D'}</button>
    {open&&<section id={region} className="mannequin-preview" aria-label="Outfit mannequin preview">
      <header><div><h3>Your outfit, together</h3><p className="muted">A simplified mannequin using your saved colours and patterns. Approximate shades, pattern sizes and garment shapes — not a fit or fabric simulation.</p></div></header>
      {error&&<p role="alert" className="error banner">{error}</p>}
      {!items&&!error&&<p role="status">Dressing the mannequin…</p>}
      {items&&<>
        <div className="mannequin-stage"><canvas ref={canvas} role="img" aria-label={`Rotatable mannequin wearing ${items.map(g=>g.name).join(', ')}. Use the view buttons or rotation slider.`}
          onPointerDown={e=>{drag.current={x:e.clientX,angle};e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{if(drag.current)rotate(drag.current.angle+(e.clientX-drag.current.x)*.6);}}
          onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} />
          <span className="mannequin-caption">DRAG TO ROTATE · APPROXIMATE PREVIEW</span>
        </div>
        <div className="mannequin-controls">
          <div className="row-actions"><button onClick={()=>setAngle(0)}>Front</button><button onClick={()=>setAngle(90)}>Side</button><button onClick={()=>setAngle(180)}>Back</button><button onClick={()=>{setAngle(15);setZoom(1);}}>Reset view</button></div>
          <label>Rotation <input aria-label="Mannequin rotation" type="range" min="-180" max="180" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label>
          <label>Zoom <input aria-label="Mannequin zoom" type="range" min=".8" max="1.15" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
        </div>
        {items.some(g=>g.slotId==='cufflinks'&&items.some(i=>i.slotId==='top'&&(!i.visualStyle?.cuffs||i.visualStyle.cuffs==='unknown')))&&<p className="banner">Cufflinks are shown provisionally. Confirm French / double cuffs in the shirt editor.</p>}
        {items.some(g=>g.slotId==='outerwear')&&<p className="muted">Outerwear covers some inner garments and accessories, just as it would when worn.</p>}
        <details className="preview-legend"><summary>Garments and preview limits</summary><ul>{items.map(g=><li key={g.id}><strong>{g.name}</strong> — {!supported.has(g.slotId)?'listed only; this accessory has no 3D shape yet':g.slotId==='pocket_square'&&!items.some(i=>i.slotId==='jacket')?'not shown: needs a jacket pocket':g.slotId==='neckwear'&&!items.some(i=>i.slotId==='top')?'not shown: needs a shirt':g.slotId==='tie_clip'&&!items.some(i=>i.style==='tie')?'not shown: requires a straight tie':g.slotId==='cufflinks'&&(!items.some(i=>i.slotId==='top')||items.some(i=>i.slotId==='top'&&i.visualStyle?.cuffs==='button'))?'not shown: requires compatible cuffs':!g.appearance?'no confirmed appearance; shown in placeholder grey':`${g.style?g.style.replaceAll('-',' ')+'; ':''}${g.visualStyle?.kind&&g.visualStyle.kind!=='auto'?'style chosen by you; ':'shape inferred from category; '}${g.appearance.primaryColour==='unknown'?'unknown colour shown in grey':g.appearance.primaryColour}; ${g.appearance.pattern==='unknown'?'unknown pattern shown plain':g.appearance.pattern==='patterned'?'generic motif, not an exact print':g.appearance.pattern}${g.appearance.pattern!=='solid'&&!g.appearance.secondaryColour?'; pattern colours unconfirmed, shown plain':''}${g.stale?'; appearance was confirmed before the latest photo change':''}`}</li>)}</ul><p>Exposed skin uses your saved mannequin colour, or neutral grey by default. The colour is approximate and can be adjusted in Personal colouring. Garments not selected are not added. Coats can cover jackets and their accessories. Small jewellery and cuff shapes are simplified; exact designs, fabric drape and fit are not reproduced. Photos are not stretched onto the mannequin.</p></details>
      </>}
    </section>}
  </div>;
}
