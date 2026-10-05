import {McfAiWorker} from '../application/mcf-ai.js';
import type {AiAnalysisProvider} from '../application/ai-analysis.js';
import {McfLifecycle,lifecycleTables,type LifecycleKind} from '../infrastructure/mcf-lifecycle.js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {z,ZodError} from 'zod';
import {MCF,MCF_HASH,datasetInput,mappingInput,sessionInput,decisionInput,representationInput,segmentInput,actor} from '../domain/mcf.js';
import {readMcfImport} from '../application/mcf-import.js';
import {McfRepository} from '../infrastructure/mcf-repository.js';

async function bytes(q:IncomingMessage,maximum=2_000_000){const chunks:Buffer[]=[];let size=0;for await(const part of q){const b=Buffer.from(part);size+=b.length;if(size>maximum)throw Error('request_too_large');chunks.push(b);}return Buffer.concat(chunks);}
async function body(q:IncomingMessage){try{return JSON.parse((await bytes(q)).toString('utf8'));}catch(e){if(e instanceof Error&&e.message==='request_too_large')throw e;throw Error('invalid_json');}}
export function createMcfApi(database:Pick<Pool,'query'|'connect'>,storageRoot:string,getProvider:()=>AiAnalysisProvider|null=()=>null,background=false){
 const repo=new McfRepository(database,storageRoot),lifecycle=new McfLifecycle(repo),worker=new McfAiWorker(repo,getProvider);
 if(background)void worker.start().catch(e=>{worker.error=e.message;});
 const send=(r:ServerResponse,status:number,value:unknown)=>{r.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});r.end(JSON.stringify(value));};
 const handle=async(q:IncomingMessage,r:ServerResponse):Promise<boolean>=>{
  const url=new URL(q.url??'/','http://127.0.0.1'),parts=url.pathname.split('/').filter(Boolean),method=q.method??'GET';if(parts[0]!=='api'||parts[1]!=='mcf')return false;
  if(method!=='GET'&&q.headers.origin&&q.headers.origin!==`http://${q.headers.host}`){send(r,403,{error:'origin_not_allowed'});return true;}
  try{
   const resource=parts[2],id=parts[3]?z.uuid().parse(parts[3]):'',action=parts[4],child=parts[5]?z.uuid().parse(parts[5]):'';
   if(resource&&Object.prototype.hasOwnProperty.call(lifecycleTables,resource)&&id){
    const kind=resource as LifecycleKind;
    if(action==='lifecycle'&&method==='GET'){send(r,200,await lifecycle.policy(kind,id));return true;}
    if(action==='history'&&method==='GET'){send(r,200,{items:await lifecycle.history(kind,id)});return true;}
    if(action==='lifecycle'&&method==='POST'){const v=z.object({action:z.enum(['rename','archive','restore','delete']),actor,label:z.string().trim().min(1).max(200).optional()}).strict().parse(await body(q));if(v.action==='rename'&&(!v.label||!['datasets','imports','sessions'].includes(kind)))throw Error('display_name_required');send(r,200,await lifecycle.change(kind,id,v.action,v.actor,v.label));return true;}
   }
   if(resource==='instrument'&&method==='GET'){send(r,200,{instrument:MCF,hash:MCF_HASH,classification:'reviewable-proposals',transmission:'explicit-ai-runs-only',provider:getProvider()?{id:getProvider()!.id,model:getProvider()!.model}:null});return true;}
   if(resource==='datasets'){
    if(!id&&method==='GET'){send(r,200,{items:await repo.list(url.searchParams.get('archived')==='true')});return true;}
    if(!id&&method==='POST'){send(r,201,await repo.create(datasetInput.parse(await body(q))));return true;}
    if(id&&!action&&method==='GET'){send(r,200,await repo.overview(id));return true;}
    if(action==='imports'&&method==='POST'){
     const filename=z.string().min(1).max(200).parse(url.searchParams.get('filename')),by=actor.parse(url.searchParams.get('actor'));await repo.dataset(id);const data=await bytes(q,25_000_000);if(!data.length)throw Error('empty_upload');
     send(r,201,await repo.storeImport(id,filename,data,await readMcfImport(data,filename),by));return true;
    }
    if(action==='sessions'&&method==='POST'){send(r,201,await repo.createSession(id,sessionInput.parse(await body(q))));return true;}
   }
   if(resource==='imports'){
    if(!action&&method==='GET'){send(r,200,await repo.import(id));return true;}
    if(action==='structural-preview'&&method==='GET'){send(r,200,await repo.structuralPreview(id));return true;}
    if(action==='map'&&method==='POST'){send(r,201,await repo.map(id,mappingInput.parse(await body(q))));return true;}
    if(action==='original'&&method==='GET'){const file=await repo.import(id),root=resolve(storageRoot),target=resolve(root,file.storage_path),route=relative(root,target);if(isAbsolute(route)||route.startsWith('..'))throw Error('invalid_archive_path');r.writeHead(200,{'content-type':'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'cache-control':'no-store','x-content-type-options':'nosniff'});r.end(await readFile(target));return true;}
   }
   if(resource==='records'){
    if(!action&&method==='GET'){send(r,200,await repo.record(id,url.searchParams.has('unitSet')?z.uuid().parse(url.searchParams.get('unitSet')):undefined));return true;}
    if(action==='segment'&&method==='POST'){send(r,201,await repo.segment(id,segmentInput.parse(await body(q))));return true;}
   }
   if(resource==='sessions'&&action==='ai'){
    if(method==='GET'){send(r,200,{...await worker.overview(id),workerError:worker.error});return true;}
    if(method==='POST'){const v=z.object({kind:z.enum(['classification','interpretation']),actor,questions:z.array(z.string().trim().min(1).max(1000)).max(20).default([])}).strict().parse(await body(q));send(r,202,await worker.enqueue(id,v.kind,v.actor,v.questions));return true;}
   }
   if(resource==='sessions'&&action==='ai-reject'&&child&&method==='POST'){const v=z.object({actor,reason:z.string().trim().min(1).max(2000)}).strict().parse(await body(q));send(r,200,await worker.reject(id,child,v.actor,v.reason));return true;}
   if(resource==='sessions'&&action==='ai-cancel'&&child&&method==='POST'){z.object({actor}).strict().parse(await body(q));send(r,200,await worker.cancel(id,child));return true;}
   if(resource==='sessions'&&action==='ai-export'&&method==='GET'){send(r,200,{contract:'researched.mcf-ai.v1',...await worker.export(id)});return true;}
   if(resource==='sessions'){
    if(!action&&method==='GET'){send(r,200,await repo.workspace(id));return true;}
    if(action==='decisions'&&child){if(method==='POST'){send(r,201,await repo.decide(id,child,decisionInput.parse(await body(q))));return true;}if(method==='GET'){send(r,200,{items:await repo.decisionHistory(id,child)});return true;}}
    if(action==='representations'&&child){if(method==='POST'){send(r,201,await repo.represent(id,child,representationInput.parse(await body(q))));return true;}if(method==='GET'){send(r,200,{items:await repo.representationHistory(id,child)});return true;}}
    if(action==='export'&&method==='GET'){r.setHeader('content-disposition',`attachment; filename="mcf-manual-${id}.json"`);send(r,200,await repo.archive(id));return true;}
   }
   send(r,404,{error:'mcf_route_not_found'});return true;
  }catch(error){const e=error as Error&{code?:string},message=e.message;const status=error instanceof ZodError?400:message.startsWith('stale_')||e.code==='23505'?409:message.endsWith('_not_found')?404:message==='request_too_large'?413:e.code?500:400;send(r,status,{error:error instanceof ZodError?'validation_failed':e.code==='23505'?'already_mapped_or_concurrent_revision':message,...(error instanceof ZodError?{issues:error.issues}:{})});return true;}
 };
 return Object.assign(handle,{worker});
}
