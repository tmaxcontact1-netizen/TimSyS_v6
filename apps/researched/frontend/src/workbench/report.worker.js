import {reportHtml} from './report.js';
self.onmessage=({data})=>{try{self.postMessage({html:reportHtml(data)});}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}};
