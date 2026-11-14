import React,{useEffect,useState} from 'react';
const base='/api/timsys/v1/apps/dressed/backend/1.0.0/outfit-collections';
export function CollectionPicker({api,value,onChange}){
 const [items,setItems]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;api(base).then(v=>{if(active)setItems(v.items);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[api]);
 return <label>Save into collection<select value={value} onChange={e=>onChange(e.target.value)}><option value="">No collection</option>{items.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select>{error&&<small role="alert">Collections unavailable: {error}</small>}</label>;
}
export default function OutfitCollections({api,collections,selected,onSelect,reload}){
 const [title,setTitle]=useState(''),[rename,setRename]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async action=>{setBusy(true);setError('');try{await action();await reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="outfit-collections"><h3>Collections</h3><p>Group saved outfits by purpose. An outfit can belong to several collections; calendar dates stay in the planner.</p>
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{const c=await api(base,{method:'POST',body:JSON.stringify({title:title.trim()})});setTitle('');onSelect(c.id);});}}><label>New collection title<input required maxLength={120} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></label><button disabled={busy||!title.trim()}>Create collection</button></form>
 <div className="row-actions"><button aria-pressed={selected==='all'} onClick={()=>onSelect('all')}>All outfits</button><button aria-pressed={selected==='none'} onClick={()=>onSelect('none')}>Without a collection</button></div>
 {collections.map(c=><div className="collection-row" key={c.id}><button aria-pressed={selected===c.id} onClick={()=>onSelect(c.id)}>{c.title} ({c.outfitIds.length})</button><button disabled={busy} onClick={()=>setRename({id:c.id,title:c.title})}>Rename</button><button disabled={busy} onClick={()=>{if(window.confirm(`Delete collection “${c.title}”? Its outfits will be kept.`))void run(async()=>{await api(`${base}/${c.id}`,{method:'DELETE'});if(selected===c.id)onSelect('all');});}}>Delete collection</button></div>)}
 {rename&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await api(`${base}/${rename.id}`,{method:'PATCH',body:JSON.stringify({title:rename.title.trim()})});setRename(null);});}}><label>Collection title<input autoFocus required maxLength={120} value={rename.title} onChange={e=>setRename({...rename,title:e.target.value})}/></label><button disabled={busy||!rename.title.trim()}>Save title</button><button type="button" disabled={busy} onClick={()=>setRename(null)}>Cancel</button></form>}{error&&<p role="alert">{error}</p>}</section>;
}
export function CollectionMembership({api,outfit,collections,reload}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const change=async(c,include)=>{setBusy(true);setError('');try{await api(`${base}/${c.id}/outfits/${outfit.id}`,{method:include?'PUT':'DELETE'});await reload();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <details><summary>Collections</summary>{!collections.length?<p>Create a collection above to organise this outfit.</p>:<fieldset disabled={busy}><legend>Include outfit in</legend>{collections.map(c=><label key={c.id}><input type="checkbox" checked={c.outfitIds.includes(outfit.id)} onChange={e=>change(c,e.target.checked)}/>{c.title}</label>)}</fieldset>}{error&&<p role="alert">{error}</p>}</details>;
}
