import { garmentStyles, styleFor } from "../../src/domain/garment/visual-style.ts";
import React from "react";

export const detailsFrom = (item={}) => ({
 visualStyle:{kind:"auto",closure:"open",cuffs:"unknown",side:"left",...item.visualStyle},
 brand:item.brand??"",productName:item.productName??"",sku:item.sku??"",fit:item.fit??"",size:item.size??"",
 tailoringNotes:item.tailoringNotes??"",notes:item.notes??"",materials:item.materials??[],restrictions:(item.restrictions??[]).join("\n"),
 condition:item.acquisition?.condition??"",purchaseDate:item.acquisition?.purchaseDate?.slice(0,10)??"",
 purchasePrice:item.acquisition?.purchasePriceMinor==null?"":String(item.acquisition.purchasePriceMinor/100),
 originalRetailPrice:item.acquisition?.originalRetailPriceMinor==null?"":String(item.acquisition.originalRetailPriceMinor/100),
 currency:item.acquisition?.currency??"",source:item.acquisition?.source??"",isGift:item.acquisition?.isGift??false,acquisitionNotes:item.acquisition?.notes??"",
});
export function detailsPayload(d){
 const nullable=value=>value.trim()||null;
 const money=value=>value===""?null:Math.round(Number(value)*100);
 return {visualStyle:d.visualStyle,brand:nullable(d.brand),productName:nullable(d.productName),sku:nullable(d.sku),fit:nullable(d.fit),size:nullable(d.size),tailoringNotes:nullable(d.tailoringNotes),notes:nullable(d.notes),materials:d.materials.map(m=>({material:m.material,percentage:m.percentage===""||m.percentage==null?null:Number(m.percentage)})),restrictions:d.restrictions.split("\n").map(x=>x.trim()).filter(Boolean),acquisition:{condition:d.condition||null,purchaseDate:d.purchaseDate||null,purchasePriceMinor:money(d.purchasePrice),originalRetailPriceMinor:money(d.originalRetailPrice),currency:nullable(d.currency)?.toUpperCase()??null,source:nullable(d.source),isGift:d.isGift,notes:nullable(d.acquisitionNotes)}};
}
export default function GarmentDetails({value,change,categorySlug}){
 const styleChange=(key,next)=>change('visualStyle',{...value.visualStyle,[key]:next});
 const choices=garmentStyles.filter(s=>s.categories.includes(categorySlug)||categorySlug==='other-accessories'&&['headwear','eyewear','watch','bracelet','ring','cufflinks','tie_clip','lapel_pin','scarf','gloves','bag','necklace','earrings','suspenders','umbrella'].includes(s.slot));
 const resolved=styleFor({categorySlug,visualStyle:value.visualStyle});
 const material=(index,key,next)=>change("materials",value.materials.map((m,i)=>i===index?{...m,[key]:next}:m));
 return <section className="garment-details"><h3>Style and mannequin</h3>
 <p>Choose the actual style. These details control the shape and placement in outfit previews; they do not measure fit.</p>
 <div className="form-grid">
 <label>Garment style<select value={value.visualStyle.kind} onChange={e=>styleChange('kind',e.target.value)}><option value="auto">Use category shape (approximate)</option>{choices.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 {['jacket','outerwear','top','waistcoat'].includes(resolved?.slot)&&<label>Wear open or closed<select value={value.visualStyle.closure} onChange={e=>styleChange('closure',e.target.value)}><option value="open">Open</option><option value="closed">Closed</option></select></label>}
 {resolved?.slot==='top'&&<label>Cuff construction<select value={value.visualStyle.cuffs} onChange={e=>styleChange('cuffs',e.target.value)}><option value="unknown">Unknown / check</option><option value="button">Button cuffs</option><option value="french">French / double cuffs (cufflinks)</option></select></label>}
 {['watch','bracelet','ring','bag','umbrella'].includes(resolved?.slot)&&<label>Worn / carried on<select value={value.visualStyle.side} onChange={e=>styleChange('side',e.target.value)}><option value="left">Left</option><option value="right">Right</option></select></label>}
 </div><h3>Garment details</h3><div className="form-grid">
 {[["brand","Brand",120],["productName","Product/model",120],["sku","SKU/reference",120],["fit","Fit",80],["size","Size",80]].map(([key,label,max])=><label key={key}>{label}<input maxLength={max} value={value[key]} onChange={e=>change(key,e.target.value)}/></label>)}
 </div><fieldset className="material-list"><legend>Materials</legend>
 {value.materials.map((m,i)=><div className="material-row" key={i}><label>Material {i+1}<input required maxLength={80} value={m.material} onChange={e=>material(i,"material",e.target.value)}/></label><label>Percentage {i+1}<input type="number" min="0.01" max="100" step="0.01" value={m.percentage??""} onChange={e=>material(i,"percentage",e.target.value)}/></label><button type="button" aria-label={`Remove material ${i+1}`} onClick={()=>change("materials",value.materials.filter((_,n)=>n!==i))}>Remove</button></div>)}
 <button type="button" disabled={value.materials.length>=20} onClick={()=>change("materials",[...value.materials,{material:"",percentage:null}])}>Add material</button></fieldset>
 <label>Tailoring notes<textarea maxLength={2000} value={value.tailoringNotes} onChange={e=>change("tailoringNotes",e.target.value)}/></label>
 <h3>Purchase and provenance</h3><div className="form-grid">
 <label>Condition<select value={value.condition} onChange={e=>change("condition",e.target.value)}><option value="">Unspecified</option><option value="new">New</option><option value="used">Used</option></select></label>
 <label>Purchase date<input type="date" value={value.purchaseDate} onChange={e=>change("purchaseDate",e.target.value)}/></label>
 {[["purchasePrice","Purchase price"],["originalRetailPrice","Original retail price"]].map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="0.01" value={value[key]} onChange={e=>change(key,e.target.value)}/></label>)}
 <label>Currency<input maxLength={3} pattern="[A-Za-z]{3}" value={value.currency} onChange={e=>change("currency",e.target.value)}/></label>
 <label>Source/store<input maxLength={160} value={value.source} onChange={e=>change("source",e.target.value)}/></label>
 </div><label className="gift-check"><input type="checkbox" checked={value.isGift} onChange={e=>change("isGift",e.target.checked)}/>Gift</label>
 <label>Purchase notes<textarea maxLength={2000} value={value.acquisitionNotes} onChange={e=>change("acquisitionNotes",e.target.value)}/></label>
 <label>Restrictions (one per line)<textarea value={value.restrictions} onChange={e=>change("restrictions",e.target.value)}/></label>
 <label>Notes<textarea maxLength={4000} value={value.notes} onChange={e=>change("notes",e.target.value)}/></label></section>;
}
