import React, {useEffect, useState} from 'react';
import DocumentaryLandscape from '../../documentary-landscape/DocumentaryLandscape';
import {fromJd} from '../../documentary-landscape/model.ts';
import {readDocumentary} from '../../documentary-landscape/read';

export default function NervousBreakdownWidget() {
  const [collections,setCollections]=useState(null),[id,setId]=useState(''),[model,setModel]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    readDocumentary('/collections',controller.signal).then(data=>{
      setCollections(data.collections);
      if(data.collections.length===1)setId(data.collections[0].id);
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[retry]);
  useEffect(()=>{
    setModel(null);if(!id)return;
    const controller=new AbortController();setError('');
    readDocumentary(`/collections/${encodeURIComponent(id)}`,controller.signal).then(data=>setModel(fromJd(data.snapshot)))
      .catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[id,retry]);
  return <section className="documentary-module">
    {collections?.length>1&&<label>Document collection <select value={id} onChange={e=>setId(e.target.value)}>
      <option value="">Choose a collection</option>{collections.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
    </select></label>}
    {error?<div role="alert"><h1>Nervous Breakdown</h1><p>{error}</p><button onClick={()=>{setError('');setRetry(r=>r+1);}}>Try again</button></div>:
      model?<DocumentaryLandscape key={`${id}/${model.revision}`} model={model}/>:
      <><h1>Nervous Breakdown</h1><p>{collections?.length===0?'No documentary collection is available. Job descriptions prepared in Research’Ed will appear here for read-only exploration.':id||!collections?'Loading documentary landscape…':'Choose a documentary collection to explore.'}</p></>}
  </section>;
}
