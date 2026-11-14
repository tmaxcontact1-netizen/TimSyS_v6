import React,{useEffect,useId,useState} from 'react';
import {createPortal} from 'react-dom';
const cache=new Map();
const base='/api/timsys/v1/apps/dressed/backend/1.0.0';
export default function GarmentName({garment,api}){
 const [anchor,setAnchor]=useState(null),[image,setImage]=useState(garment.imageId||null),[status,setStatus]=useState(''),id=useId();
 useEffect(()=>{if(!anchor)return;let active=true;
  if(garment.imageId){setImage(garment.imageId);return;}
  setStatus('Loading photograph…');
  let pending=cache.get(garment.id);
  if(!pending){pending=api(`${base}/garments/${garment.id}/images`).then(v=>v.items.find(i=>i.isCurrent&&i.role==='whole')?.id||v.items.find(i=>i.isCurrent)?.id||null);cache.set(garment.id,pending);pending.catch(()=>cache.delete(garment.id));}
  pending.then(value=>{if(active){setImage(value);setStatus(value?'':'No photograph available');}}).catch(()=>{if(active)setStatus('Photograph unavailable');});
  return()=>{active=false;};
 },[!!anchor,garment.id,garment.imageId,api]);
 useEffect(()=>{if(!anchor)return;const close=()=>setAnchor(null);window.addEventListener('scroll',close,true);window.addEventListener('resize',close);return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};},[!!anchor]);
 const show=e=>{const r=e.currentTarget.getBoundingClientRect();setAnchor({left:Math.max(8,Math.min(r.left,window.innerWidth-228)),top:r.bottom+250>window.innerHeight?Math.max(8,r.top-250):r.bottom+6});};
 return <span className="garment-name" tabIndex={0} onMouseEnter={show} onMouseLeave={()=>setAnchor(null)} onFocus={show} onBlur={()=>setAnchor(null)} onKeyDown={e=>{if(e.key==='Escape')setAnchor(null);}} aria-describedby={anchor?id:undefined}>{garment.name}{anchor&&createPortal(<span id={id} role="tooltip" className="garment-photo-tooltip" style={anchor}>{image?<img src={`${base}/images/${image}/content`} alt={garment.name} onError={()=>{setImage(null);setStatus('Photograph unavailable');}}/>:<span>{status||'No photograph available'}</span>}<strong>{garment.name}</strong></span>,document.body)}</span>;
}
