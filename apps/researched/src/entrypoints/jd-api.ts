import type {IncomingMessage,ServerResponse} from 'node:http';
import {mkdir,readFile,writeFile,rename,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {extractJd,unpackJds,JD_RULES,type JdDocument} from '../application/jd-documents.js';
import {jdMatrix,type JdReview} from '../domain/jd-matrix.js';

type Project={id:string;title:string;createdAt:string;updatedAt:string;revision:number;rules:string;documents:JdDocument[];review:JdReview;undo:JdReview[];redo:JdReview[];history:{at:string;action:string}[]};
const reviewSchema=z.object({roles:z.record(z.string(),z.string().max(300)),excluded:z.array(z.string()).max(20000),confirmed:z.boolean(),structure:z.record(z.string(),z.object({kind:z.enum(['statement','metadata','heading']),dimension:z.string().max(1000)}).strict()).optional()}).strict();
async function body(q:IncomingMessage,limit=25_000_000){const parts:Buffer[]=[];let size=0;for await(const p of q){const b=Buffer.from(p);size+=b.length;if(size>limit)throw Error('Upload exceeds 25 MB');parts.push(b);}return Buffer.concat(parts);}
export function createJdApi(storageRoot:string){
 const root=join(storageRoot,'jd-responsibilities');let queue:Promise<unknown>=Promise.resolve();
 const read=async(id:string):Promise<Project>=>JSON.parse(await readFile(join(root,id,'project.json'),'utf8'));
 const persist=async(p:Project,action:string)=>{p.revision++;p.updatedAt=new Date().toISOString();p.history.push({at:p.updatedAt,action});const file=join(root,p.id,'project.json'),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(p));await rename(temp,file);};
 const send=(r:ServerResponse,value:unknown,status=200)=>{r.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});r.end(JSON.stringify(value));};
 return async(q:IncomingMessage,r:ServerResponse)=>{
  const url=new URL(q.url??'/','http://localhost');if(!url.pathname.startsWith('/api/jd'))return false;
  const match=/^\/api\/jd(?:\/([a-f0-9-]{36})(?:\/(review|undo|redo|confirm|documents|export|source)(?:\/([a-f0-9-]{36}))?)?)?$/.exec(url.pathname);
  if(!match){send(r,{error:'Unknown responsibility tool route'},404);return true;}
  if(q.method!=='GET'&&q.headers.origin&&q.headers.origin!==`http://${q.headers.host}`){send(r,{error:'Origin not allowed'},403);return true;}
  const operation=async()=>{
   try{
    const id=match[1],action=match[2],child=match[3];
    if(!id){
     if(q.method==='GET'){let ids:string[]=[];try{ids=await readdir(root);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}const items=[];for(const key of ids.filter(x=>z.uuid().safeParse(x).success)){const p=await read(key);items.push({id:p.id,title:p.title,updatedAt:p.updatedAt,documents:p.documents.length,confirmed:p.review.confirmed});}send(r,{items:items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});return;}
     if(q.method==='POST'){const v=z.object({title:z.string().trim().min(1).max(200)}).parse(JSON.parse((await body(q,10000)).toString()));const p:Project={id:randomUUID(),title:v.title,createdAt:new Date().toISOString(),updatedAt:'',revision:0,rules:JD_RULES,documents:[],review:{roles:{},excluded:[],confirmed:false},undo:[],redo:[],history:[]};await mkdir(join(root,p.id),{recursive:true});await persist(p,'Created');send(r,p,201);return;}
    }
    if(!id)throw Error('Invalid request');z.uuid().parse(id);if(child)z.uuid().parse(child);
    const p=await read(id);
    if(q.method==='GET'){
     if(action==='source'&&child){const d=p.documents.find(x=>x.id===child);if(!d)throw Error('Source not found');r.writeHead(200,{'content-type':'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.filename)}`,'cache-control':'no-store'});r.end(await readFile(join(root,id,child+'.bin')));return;}
     if(action==='export'){if(!p.review.confirmed)throw Error('Check and confirm extraction before exporting');send(r,{...p,matrix:jdMatrix(p.documents,p.review,url.searchParams.get('search')??'')});return;}
     send(r,p);return;
    }
    if(q.method==='POST'&&action==='documents'){
     if(p.review.confirmed)throw Error('Choose Edit extraction before adding documents');
     const revision=Number(url.searchParams.get('revision'));if(revision!==p.revision)throw Error('Work changed; reload before saving');
     const filename=z.string().min(1).max(250).parse(url.searchParams.get('filename'));const entries=await unpackJds(await body(q),filename);
     if(p.documents.length+entries.length>50)throw Error('Maximum 50 documents per collection');
     const docs=[];for(const entry of entries)docs.push(await extractJd(entry.bytes,entry.filename));
     for(let i=0;i<docs.length;i++)await writeFile(join(root,id,docs[i]!.id+'.bin'),entries[i]!.bytes);
     p.documents.push(...docs);p.review.confirmed=false;p.undo=[];p.redo=[];await persist(p,`Uploaded ${docs.length} documents`);send(r,p);return;
    }
    const v=JSON.parse((await body(q,2_000_000)).toString());if(v.revision!==p.revision)throw Error('Work changed; reload before saving');
    if(q.method==='DELETE'){
     if(v.confirm!==true)throw Error('Confirm permanent deletion');
     if(action==='documents'&&child){const d=p.documents.find(x=>x.id===child);if(!d)throw Error('Source not found');p.documents=p.documents.filter(x=>x.id!==child);delete p.review.roles[child];for(const passage of d.passages)if(p.review.structure)delete p.review.structure[passage.id];p.review.excluded=p.review.excluded.filter(x=>!d.passages.some(y=>y.id===x));p.review.confirmed=false;p.undo=[];p.redo=[];await persist(p,'Permanently deleted source and cleared undo history');await rm(join(root,id,child+'.bin'),{force:true});send(r,p);return;}
     if(!action){await rm(join(root,id),{recursive:true,force:true});send(r,{deleted:true});return;}
    }
    if(q.method==='POST'&&['review','confirm','undo','redo'].includes(action??'')){
     if(action==='undo'||action==='redo'){const from=action==='undo'?p.undo:p.redo,to=action==='undo'?p.redo:p.undo;const prior=from.pop();if(!prior)throw Error('Nothing to '+action);to.push(p.review);p.review=prior;}
     else {const next=action==='confirm'?{...p.review,confirmed:true}:reviewSchema.parse(v.review);if(!p.documents.length)throw Error('Upload documents first');if(Object.keys(next.roles).some(k=>!p.documents.some(d=>d.id===k))||next.excluded.some(k=>!p.documents.some(d=>d.passages.some(x=>x.id===k))))throw Error('Unknown source or passage');for(const [key,value]of Object.entries(next.roles)){const d=p.documents.find(d=>d.id===key)!;if(value&&!d.extracted.replace(/\s+/g,' ').includes(value.replace(/\s+/g,' ')))throw Error('Role title must use wording present in the original document');}for(const [key,value]of Object.entries(next.structure??{})){const d=p.documents.find(d=>d.passages.some(x=>x.id===key&&x.kind!=='heading'));if(!d||(value.kind==='heading'?!d.passages.some(x=>x.id===key&&x.text.trim()===value.dimension):!d.passages.some(x=>x.dimension===value.dimension||(next.structure?.[x.id]?.kind==='heading'&&x.text.trim()===value.dimension))))throw Error('Choose a dimension present in the original document');}p.undo.push(p.review);p.redo=[];p.review=next;}
     await persist(p,action!);send(r,p);return;
    }throw Error('Unsupported action');
   }catch(e){send(r,{error:e instanceof Error?e.message:String(e)},(e as NodeJS.ErrnoException).code==='ENOENT'?404:400);}
  };
  // Serialize mutations and reads so downloads cannot observe a half-written revision.
  const work=queue.then(operation,operation);queue=work.catch(()=>{});await work;return true;
 };
}
