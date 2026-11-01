const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export function photographyRoute(url,method='GET',body={}){
 const u=new URL(url,'http://timsys.invalid'),p=u.pathname,m=method.toUpperCase();
 if(p==='/api/calibration-profiles')return m==='GET'?{operation:'profiles',input:{}}:m==='POST'?{operation:'profile_create',input:body,command:true}:null;
 if(p==='/api/calibration-profiles/from-photo'&&m==='POST')return{binary:true,metadata:{purpose:'calibration',name:u.searchParams.get('name'),filename:body.name||'calibration-photo'}};
 let match=/^\/api\/calibration-profiles\/([0-9a-f-]{36})$/i.exec(p);if(match&&m==='DELETE')return{operation:'profile_retire',input:{id:match[1]},command:true};
 match=/^\/api\/garments\/([0-9a-f-]{36})\/images$/i.exec(p);if(match){if(m==='GET')return{operation:'images',input:{garmentId:match[1]}};if(m==='POST')return{binary:true,metadata:{purpose:'image',garmentId:match[1],role:u.searchParams.get('role'),profileId:u.searchParams.get('calibrationProfileId'),filename:u.searchParams.get('filename')||body.name||'original',capturedAt:u.searchParams.get('capturedAt')}};}
 match=/^\/api\/garments\/([0-9a-f-]{36})\/fingerprint$/i.exec(p);if(match&&['GET','POST'].includes(m))return{operation:m==='GET'?'fingerprint':'fingerprint_generate',input:{garmentId:match[1]},command:m==='POST'};
 match=/^\/api\/fingerprints\/([0-9a-f-]{36})\/decision$/i.exec(p);if(match&&m==='POST')return{operation:'fingerprint_decide',input:{id:match[1],...body},command:true};
 return null;
}
export function createPhotographyApi({invoke,upload,content,storage=globalThis.sessionStorage,crypto=globalThis.crypto}){
 async function request(url,options={}){const body=typeof options.body==='string'?JSON.parse(options.body):options.body,route=photographyRoute(url,options.method,body);if(!route)return null;let key,storageKey,bytes;
  if(route.binary){if(!body?.arrayBuffer||body.size<1||body.size>25000000)throw Error('Choose a PNG or JPEG image up to 25 MB.');bytes=new Uint8Array(await body.arrayBuffer());const hash=await crypto.subtle.digest('SHA-256',bytes);route.metadata.contentHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');route.metadata.byteSize=bytes.length;}
  if(route.command||route.binary){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(route))));storageKey='dressed.photography.command.'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');key=storage.getItem(storageKey);if(!key){key=crypto.randomUUID();storage.setItem(storageKey,key);}}
  try{const result=route.binary?await upload(route.metadata,bytes,key):await invoke(route.operation,route.input,key);if(storageKey)storage.removeItem(storageKey);return result;}catch(error){if(storageKey&&error.status>=400&&error.status<500&&![408,409,429,499].includes(error.status))storage.removeItem(storageKey);throw error;}
 }
 request.content=content;return request;
}
