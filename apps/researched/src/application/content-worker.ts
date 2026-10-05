import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {answerQuestions} from "./question-analysis.js";
import { load } from "cheerio";
import { contentHash } from "@timsys/app-sdk";
import { ContentRepository } from "../infrastructure/content-repository.js";
import { ResearchRepository } from "../infrastructure/repository.js";
import { acquireSource, acquireRenderedSource, preserveSource, type AcquiredSource } from "./source-acquisition.js";
import { analyseContent, readContentPage, rankSupportingLinks } from "./content-reader.js";
import { canonicalContentUrl, contentPlanInput, failureObservation, type CapturedPage, type ContentPlan, type ContentResult } from "../domain/content-analysis.js";
import type { AiAnalysisProvider } from "./ai-analysis.js";

export interface ContentWorkerOptions {
  database: Pick<Pool,"query"|"connect">; storageRoot: string;
  acquire?: typeof acquireSource; render?: typeof acquireRenderedSource;
  getAiProvider: () => AiAnalysisProvider | null;
}

export class ContentWorker {
  readonly repo: ContentRepository;
  readonly archive: ResearchRepository;
  readonly active = new Map<string, {runId:string; controller:AbortController}>();
  private captures = new Map<string, Promise<AcquiredSource & {snapshotId:string}>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  error: string | null = null;
  constructor(readonly options:ContentWorkerOptions) {
    this.repo=new ContentRepository(options.database); this.archive=new ResearchRepository(options.database);
  }
  async start(interval=1000) {
    await this.repo.recover();
    this.timer=setInterval(()=>{void this.tick();},interval); this.timer.unref();
  }
  async stop() {if(this.timer)clearInterval(this.timer); for(const value of this.active.values())value.controller.abort();}
  async cancel(runId:string) {const result=await this.repo.cancel(runId);for(const value of this.active.values())if(value.runId===runId)value.controller.abort();return result;}
  async tick() {
    if(this.busy)return;
    this.busy=true;
    try {await Promise.all([this.process(),this.process()]);await this.repo.settle();this.error=null;}
    catch(error){this.error=error instanceof Error?error.message:String(error);}
    finally{this.busy=false;}
  }
  private async capture(workflowId:string,url:string, signal:AbortSignal,policy?:ContentPlan) {
    const key=`${workflowId}\n${url}\n${policy?.followDocuments}\n${policy?.followWebpages}`;
    const existing=this.captures.get(key); if(existing)return existing;
    const pending=(async()=>{
      const source=await this.repo.source(workflowId,url,url), attemptId=randomUUID(), at=new Date().toISOString();
      await this.archive.beginRetrieval(attemptId,source.id,url,at);
      try {
        signal.throwIfAborted();
        const acceptMediaType=(type:string)=>!policy||(type.includes('html')?policy.followWebpages:policy.followDocuments);
        let captured=await(this.options.acquire??acquireSource)(url,{timeoutMs:25000,signal,acceptMediaType});
        if(!acceptMediaType(captured.mediaType))throw Error('source_excluded_by_policy');
        signal.throwIfAborted();
        if(captured.mediaType.includes("html")) {
          const $=load(captured.bytes.toString("utf8"));
          const dynamic=$("details,[aria-expanded=false],[data-toggle=collapse],[data-bs-toggle=collapse]").length>0 || $("main").text().trim().length<200 || /loading (?:course|content|programme|program)|enable javascript/i.test($("body").text());
          if(dynamic) {
            try {captured=await(this.options.render??acquireRenderedSource)(url,{expandInteractiveContent:true,maximumInteractions:40,timeoutMs:35000,signal});}
            catch(error){signal.throwIfAborted();captured={...captured,metadata:{...captured.metadata,renderWarning:error instanceof Error?error.message:String(error)}};}
          }
        }
        signal.throwIfAborted();
        const saved=(await this.options.database.query("SELECT id FROM researched.source_snapshots WHERE source_id=$1 AND content_hash=$2",[source.id,captured.hash])).rows[0];
        const snapshotId=saved?.id??randomUUID();
        const storagePath=saved?"":await preserveSource(this.options.storageRoot,source.id,snapshotId,captured.bytes,captured.mediaType);
        await this.archive.completeRetrieval({attemptId,sourceId:source.id,snapshotId,at,resolvedUrl:captured.resolvedUrl,status:captured.status,hash:captured.hash,mediaType:captured.mediaType,byteLength:captured.bytes.length,storagePath,metadata:captured.metadata,unchanged:Boolean(saved)});
        return {...captured,snapshotId};
      }catch(error){await this.archive.failRetrieval(attemptId,source.id,new Date().toISOString(),JSON.stringify(failureObservation(error,url,null)));throw error;}
    })();
    this.captures.set(key,pending);
    try{return await pending;}finally{this.captures.delete(key);}
  }
  async process() {
    const task=await this.repo.claim();if(!task)return;
    const context=await this.repo.context(task.id), controller=new AbortController();
    this.active.set(task.id,{runId:task.run_id,controller});
    const signal=controller.signal, plan=contentPlanInput.parse(context.plan);
    const check=async()=>{signal.throwIfAborted();if(!await this.repo.active(task.id))throw new Error("capture_cancelled");};
    const pages:CapturedPage[]=[], observations:ContentResult["observations"]=[], suggestions:ContentResult["suggestions"]=[];
    const queue=[{url:context.url as string,depth:0,parentUrl:null as string|null,reason:"Source link supplied by researcher"}], seen=new Set<string>();
    let rootError:unknown=null;
    try {
      while(queue.length && seen.size<plan.maxPages) {
        await check();
        const item=queue.shift()!,key=canonicalContentUrl(item.url);if(seen.has(key))continue;seen.add(key);
        try {
          const capture=await this.capture(context.workflow_id,key,signal,item.depth>0?plan:undefined);await check();
          const page=await readContentPage(capture.bytes,capture.mediaType,capture.resolvedUrl,{id:contentHash(`${capture.resolvedUrl}\n${capture.hash}`),requestedUrl:key,hash:capture.hash,capturedAt:new Date().toISOString(),depth:item.depth,parentUrl:item.parentUrl,reason:item.reason,snapshotId:capture.snapshotId});
          if(capture.metadata.renderWarning)page.warnings.push(`Interactive content could not be fully captured: ${capture.metadata.renderWarning}`);
          if(new URL(capture.resolvedUrl).pathname === "/" && new URL(key).pathname !== "/")page.warnings.push("The supplied link redirected to a homepage. Verify that these passages describe the intended programme.");
          if(/page not found|404 not found/i.test(page.title))throw Object.assign(new Error("soft_404"),{status:404});
          if(/access denied|just a moment|verify you are human/i.test(page.title))throw Object.assign(new Error("access_denied"),{status:403});
          if(!page.blocks.length)throw new Error("empty_extraction");
          pages.push(page); observations.push({url:key,status:capture.resolvedUrl!==key?"redirected":"available",detail:capture.resolvedUrl,parentUrl:item.parentUrl,httpStatus:capture.status});
          if(capture.mediaType.includes("html") && item.depth<plan.maxDepth && (plan.followWebpages||plan.followDocuments)) {
            for(const link of rankSupportingLinks(capture.bytes.toString("utf8"),capture.resolvedUrl,context.url,plan)) {
              if(seen.has(link.url)||queue.some(x=>x.url===link.url))continue;
              if(link.allowed)queue.push({url:link.url,depth:item.depth+1,parentUrl:page.url,reason:link.reason});
              else suggestions.push({url:link.url,label:link.label,reason:`Review this host before following: ${link.reason}`});
            }
          }
        }catch(error){signal.throwIfAborted();observations.push(failureObservation(error,key,item.parentUrl));if(item.depth===0){rootError=error;break;}}
      }
      let result=analyseContent(pages,plan); result.observations=observations;result.suggestions=suggestions.slice(0,40);
      if(queue.length)result.warnings.push(`Capture budget reached (${plan.maxPages} pages or depth ${plan.maxDepth}); additional relevant links remain.`);
      if(rootError) {
        const observation=observations[0]!;
        if(observation.status==="missing" && plan.maxPages>1 && plan.maxDepth>0 && plan.followWebpages) {
          // A replacement is only a suggestion. It never changes the supplied source identity.
          try {
            const home=new URL("/",context.url).href;
            const captured=await this.capture(context.workflow_id,home,signal);
            result.suggestions=rankSupportingLinks(captured.bytes.toString("utf8"),home,context.url,plan).filter(x=>x.allowed).slice(0,8).map(x=>({url:x.url,label:x.label,reason:"Possible official replacement discovered on the provider homepage; verify before importing."}));
          }catch{/* Keep the original missing-link observation even when discovery also fails. */}
        }
        await check();await this.repo.fail(task.id,observation,result);return;
      }
      const documentLabels=context.occurrences.map((x:{context:string})=>x.context).join(" | ");
      if(documentLabels)result.warnings.push("Document labels are supplied context, not verified provider or qualification identities. Refer to the captured page title and passages.");
      if(plan.aiEnabled) result=await this.assist(result,plan,signal);
      await check();await this.repo.finish(task.id,result);
    }catch(error){if(!signal.aborted)await this.repo.fail(task.id,failureObservation(error,context.url,null));}
    finally{this.active.delete(task.id);}
  }
  async assist(result:ContentResult,plan:ContentPlan,signal:AbortSignal) {
    const provider=this.options.getAiProvider();
    if(!provider){result.ai={status:"unavailable",notes:[],detail:"Connect an AI provider to answer questions. Captured evidence is retained."};return result;}
    try{const response=await answerQuestions(provider,result.pages.flatMap(p=>p.blocks).map(b=>({id:b.id,content:b.text})),plan.questions.length?plan.questions:[plan.goal],`Research objective: ${plan.goal}. Keep providers, qualifications and pages distinct.`,signal);result.ai={status:"assisted",notes:[],answers:response.answers,detail:response.detail};}
    catch(error){result.ai={status:"failed",notes:[],detail:`AI analysis did not complete: ${error instanceof Error?error.message:String(error)}. Captured evidence is retained; retry the analysis.`};}
    return result;
  }
}
