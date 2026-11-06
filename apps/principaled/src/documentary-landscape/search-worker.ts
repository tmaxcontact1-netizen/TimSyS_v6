import {SearchIndex} from './model';
let index:SearchIndex|undefined;
self.onmessage=event=>{
  try {
    if(event.data.model){index=new SearchIndex(event.data.model);self.postMessage({ready:true});}
    else self.postMessage({query:event.data.query,ids:index?.find(event.data.query).map(s=>s.id)||[]});
  } catch {self.postMessage({error:'Document search could not be prepared. Reload the collection to try again.'});}
};
