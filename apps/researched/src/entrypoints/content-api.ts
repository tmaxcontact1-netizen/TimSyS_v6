import type { IncomingMessage, ServerResponse } from "node:http";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { contentHash } from "@timsys/app-sdk";
import { ContentWorker, type ContentWorkerOptions } from "../application/content-worker.js";
import { readDocumentLinks } from "../application/content-reader.js";
import { preserveSource } from "../application/source-acquisition.js";
import { canonicalContentUrl, contentPlanInput, workflowInput, FIELD_CATALOG, type ContentResult } from "../domain/content-analysis.js";
import { aiConnectionInput } from "../domain/analysis.js";
import { createAiAnalysisProvider, type AiAnalysisProvider } from "../application/ai-analysis.js";

const uuid=z.string().uuid();
async function body(request:IncomingMessage,maximum=1_000_000) {const chunks:Buffer[]=[];let length=0;for await(const chunk of request){const bytes=Buffer.from(chunk);length+=bytes.length;if(length>maximum)throw new Error("request_too_large");chunks.push(bytes);}return Buffer.concat(chunks);}
async function jsonBody(request:IncomingMessage) {try{return JSON.parse((await body(request)).toString("utf8"));}catch(error){if(error instanceof Error&&error.message==="request_too_large")throw error;throw new Error("invalid_json");}}
const csvCell=(value:unknown)=>{let text=String(value??"");if(/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
export function contentCsv(run:{tasks:{url:string;status:string;error?:{status?:string};result?:ContentResult}[]}) {
  const rows:unknown[][]=[["URL","Status","Title","Resource type",...FIELD_CATALOG.map(f=>f.label),"Missing sections","Source URLs","AI answers"]];
  for(const task of run.tasks){const result=task.result;rows.push([task.url,task.error?.status??task.status,result?.title,result?.kind,...FIELD_CATALOG.map(f=>result?.fields[f.id]?.map(b=>`${b.text} [${result.pages.find(p=>p.id===b.pageId)?.url} — ${b.locator}]`).join("\n")??""),result?.coverage.missing.join("; "),result?.pages.map(p=>p.url).join("\n"),result?.ai.answers?.map(a=>a.question+": "+(a.status==="not-found"?"Not found in inspected evidence":a.findings.map(f=>f.text+" ["+f.evidence.map(e=>e.quote).join("; ")+"]").join("\n"))).join("\n\n")??""]);}
  return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
}

export function createContentApi(options:ContentWorkerOptions & {background:boolean; setProvider:(provider:AiAnalysisProvider|null)=>void}) {
  const worker=new ContentWorker(options), repo=worker.repo;
  if(options.background)void worker.start().catch(error=>{worker.error=error.message;});
  const send=(response:ServerResponse,status:number,value:unknown)=>{response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});response.end(JSON.stringify(value));};
  const handle=async(request:IncomingMessage,response:ServerResponse):Promise<boolean>=>{
    const url=new URL(request.url??"/","http://127.0.0.1"),path=url.pathname,method=request.method??"GET";
    if(!path.startsWith("/api/content/"))return false;
    // This is a loopback desktop API: reject cross-origin browser writes, including form submissions.
    const origin=request.headers.origin;
    if(method!=="GET" && origin && origin!==`http://${request.headers.host}`){send(response,403,{error:"origin_not_allowed"});return true;}
    try {
      if(path==="/api/content/catalog"&&method==="GET") {send(response,200,{fields:FIELD_CATALOG.map(({id,label})=>({id,label})),aiAvailable:Boolean(options.getAiProvider()),provider:options.getAiProvider()?{id:options.getAiProvider()!.id,model:options.getAiProvider()!.model}:null,workerError:worker.error});return true;}
      if(path==="/api/content/provider"&&method==="POST") {const value=aiConnectionInput.parse(await jsonBody(request));options.setProvider(createAiAnalysisProvider({protocol:value.protocol,model:value.model,baseUrl:value.baseUrl,...(value.apiKey?{apiKey:value.apiKey}:{})}));send(response,200,{configured:true,persistence:"memory-only"});return true;}
      if(path==="/api/content/workflows") {
        if(method==="GET"){send(response,200,{items:await repo.list()});return true;}
        if(method==="POST"){const value=workflowInput.parse(await jsonBody(request));send(response,201,await repo.create(value.title,value.plan));return true;}
      }
      const workflowMatch=/^\/api\/content\/workflows\/([^/]+)(?:\/(document|run|links)(?:\/([^/]+))?)?$/.exec(path);
      if(workflowMatch){
        const id=uuid.parse(workflowMatch[1]), action=workflowMatch[2];
        const workflow=await repo.get(id);if(!workflow){send(response,404,{error:"workflow_not_found"});return true;}
        if(!action&&method==="GET"){send(response,200,workflow);return true;}
        if(action==="links"&&method==="POST") {const value=z.object({urls:z.array(z.string().trim().min(1).max(3000)).min(1).max(500)}).strict().parse(await jsonBody(request));const links=value.urls.map((raw,i)=>{let address:string;try{address=canonicalContentUrl(raw);}catch{throw Error('invalid_manual_link');}return {url:address,occurrences:[{label:'Manually entered link',context:raw,locator:`manual entry ${i+1}`,originalUrl:raw}]};});await repo.importLinks(id,links,null);send(response,201,await repo.get(id));return true;}
        if(action==="links"&&method==="PATCH") {const value=z.object({included:z.boolean()}).strict().parse(await jsonBody(request));send(response,200,await repo.decide(id,uuid.parse(workflowMatch[3]),value.included));return true;}
        if(action==="document"&&method==="POST") {
          const filename=z.string().min(1).max(250).parse(url.searchParams.get("filename")), extension=filename.split(".").at(-1)?.toLowerCase();
          if(!["docx","pdf"].includes(extension??""))throw new Error("upload_a_word_or_pdf_document");
          await repo.assertIdle(options.database,id);
          const bytes=await body(request,50_000_000);if(!bytes.length)throw new Error("empty_upload");
          const mediaType=extension==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          const intake=await readDocumentLinks(bytes,mediaType);
          if(!intake.links.length){send(response,422,{error:"no_links_found",warnings:intake.warnings});return true;}
          const sourceId=randomUUID(),snapshotId=randomUUID(),attemptId=randomUUID(),at=new Date().toISOString();
          const source=await repo.source(id,`upload://${sourceId}/${encodeURIComponent(filename)}`,filename);
          await worker.archive.beginRetrieval(attemptId,source.id,source.original_url,at);
          const storagePath=await preserveSource(options.storageRoot,source.id,snapshotId,bytes,mediaType);
          await worker.archive.completeRetrieval({attemptId,sourceId:source.id,snapshotId,at,resolvedUrl:source.original_url,status:200,hash:contentHash(bytes),mediaType,byteLength:bytes.length,storagePath,metadata:{filename,uploaded:true},unchanged:false});
          await repo.importLinks(id,intake.links,source.id);
          send(response,201,{workflow:await repo.get(id),import:{links:intake.links.length,occurrences:intake.links.reduce((n,l)=>n+l.occurrences.length,0),warnings:intake.warnings}});return true;
        }
        if(action==="run"&&method==="POST") {
          const value=z.object({plan:contentPlanInput,retryRunId:uuid.optional(),selectedLinkIds:z.array(uuid).min(1).max(500).optional()}).strict().parse(await jsonBody(request));
          if(value.plan.aiEnabled&&!options.getAiProvider())throw new Error("ai_provider_not_configured");
          send(response,202,await repo.start(id,value.plan,value.retryRunId,value.selectedLinkIds));return true;
        }
      }
      const runMatch=/^\/api\/content\/runs\/([^/]+)(?:\/(cancel|export))?$/.exec(path);
      if(runMatch){
        const id=uuid.parse(runMatch[1]), run=await repo.run(id);if(!run){send(response,404,{error:"run_not_found"});return true;}
        if(!runMatch[2]&&method==="GET"){send(response,200,run);return true;}
        if(runMatch[2]==="cancel"&&method==="POST"){send(response,200,await worker.cancel(id));return true;}
        if(runMatch[2]==="export"&&method==="GET") {
          const csv=url.searchParams.get("format")==="csv";
          response.writeHead(200,{"content-type":csv?"text/csv; charset=utf-8":"application/json; charset=utf-8","content-disposition":`attachment; filename="researched-${id}.${csv?"csv":"json"}"`,"cache-control":"no-store","x-content-type-options":"nosniff"});response.end(csv?contentCsv(run):JSON.stringify(run,null,2));return true;
        }
      }
      send(response,404,{error:"not_found"});return true;
    }catch(error){
      const message=error instanceof Error?error.message:"internal_error";
      const conflict=["analysis_already_running","no_selected_links","run_not_active","ai_provider_not_configured"].includes(message);
      const code=(error as {code?:string})?.code;
      send(response,error instanceof ZodError?400:conflict||code==="23505"?409:message==="request_too_large"?413:["invalid_manual_link","invalid_json","empty_upload","upload_a_word_or_pdf_document"].includes(message)?400:500,{error:error instanceof ZodError?"validation_failed":code==="23505"?"analysis_already_running":message, ...(error instanceof ZodError?{issues:error.issues}:{})});return true;
    }
  };
  return {handle,worker};
}
export type ContentDatabase = Pick<Pool,"query"|"connect">;
