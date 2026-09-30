import {adapt,layout} from './model.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:layout(adapt(data))});}catch(error){self.postMessage({error:error.message});}};
