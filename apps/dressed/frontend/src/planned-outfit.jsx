import GarmentName from "./garment-name.jsx";
import React, {useState} from 'react';
import OutfitPreview from './outfit-preview.jsx';

const types = [['bottom','Trousers'],['jacket','Jackets'],['outerwear','Coats / outerwear'],['top','Shirts / tops'],['footwear','Shoes'],['belt','Belts'],['neckwear','Ties / neckwear'],['pocket_square','Pocket squares']];
export default function PlannedOutfit({outfit, api}) {
  const [open,setOpen]=useState(false);
  const garments=outfit?.items || outfit?.garments || [];
  const slots=[...new Set(garments.map(g=>g.slotId||'accessory'))];
  const rank=slot=>{const index=types.findIndex(([id])=>id===slot);return index<0?types.length:index;};
  slots.sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
  return <details className="planned-outfit-details" onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>View outfit and garments</summary>
    {open&&<div className="planned-outfit-content">
      <h4>{outfit?.name || 'Planned outfit'}</h4>
      {!garments.length?<p role="status">The garments for this outfit are unavailable. Reopen Dress’Ed to load the latest planner; if the outfit was removed, choose a replacement.</p>:<>
        <div className="planned-outfit-garments">{slots.map(slot=><section key={slot}>
          <h5>{types.find(([id])=>id===slot)?.[1]||slot.replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase())}</h5>
          <ul>{garments.filter(g=>(g.slotId||'accessory')===slot).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'})).map(g=><li key={g.id}><GarmentName garment={g} api={api}/></li>)}</ul>
        </section>)}</div>
        {outfit.notes&&<p>{outfit.notes}</p>}
        <OutfitPreview garments={garments} api={api}/>
      </>}
    </div>}
  </details>;
}
