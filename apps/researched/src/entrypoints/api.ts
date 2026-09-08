import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, isAbsolute, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import pg, { type Pool } from "pg";
import { ZodError } from "zod";
import { createApplicationHealth, contentHash } from "@timsys/app-sdk";
import {
  studyInput,
  entityTypeInput,
  entityInput,
  sourceInput,
  sourceDecision,
  researchCodeInput,
  evidenceInput,
  findingInput,
  reportInput,
  studyTransitionInput,
  evidenceTransitionInput,
  findingTransitionInput,
  discoveryInput,
  discoveryDecisionInput,
  queueInput,
  queueRunInput,
  batchSourceInput,
  renderedFetchInput,
} from "../domain/contracts.js";
import { loadConfig } from "../infrastructure/config.js";
import { ResearchRepository } from "../infrastructure/repository.js";
import {
  acquireSource,
  acquireRenderedSource,
  findBrowserExecutable,
  preserveSource,
} from "../application/source-acquisition.js";
import { extractStoredSnapshot } from "../application/source-extraction.js";
import { assembleReport, renderReportHtml } from "../application/reporting.js";
import { discoverStoredLinks } from "../application/link-discovery.js";
import { analyseDeterministically } from "../application/deterministic-analysis.js";
import { analysisRetry } from "../application/analysis-jobs.js";
import { ANALYSIS_RESULT_CONTRACT_VERSION, analysisResultJsonSchemas, jsonSchemaForAnalysis, parseAnalysisValue, parseStoredAnalysisResult, validateAnalysisSourceRelationships } from "../domain/analysis-results.js";
import { balancedCorpusEvidence, corpusInstructions } from "../application/cross-source-analysis.js";
import { analysisRunArchive, analysisRunCsv, analysisRunMarkdown } from "../application/analysis-export.js";
import { buildResearchInsights } from "../application/research-insights.js";
import type { AnalysisTypeId } from "../domain/analysis.js";
import { ANALYSIS_CATALOG, analysisPlanInput, analysisTemplateInput, analysisRunInput, analysisRunControlInput, analysisFindingDecisionInput,aiConnectionInput,aiDiscoveryInput } from "../domain/analysis.js";
import { AI_PROVIDER_PROTOCOLS, createAiAnalysisProvider, inspectAiConnection, runGroundedAiAnalysis, type AiAnalysisProvider, type AiProviderConfiguration } from "../application/ai-analysis.js";
function secure(r: ServerResponse) {
  r.setHeader("Cache-Control", "no-store");
  r.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
  );
  r.setHeader("X-Content-Type-Options", "nosniff");
}
function json(r: ServerResponse, s: number, v: unknown) {
  secure(r);
  r.writeHead(s, { "content-type": "application/json; charset=utf-8" });
  r.end(JSON.stringify(v));
}
function documentResponse(
  r: ServerResponse,
  mediaType: string,
  filename: string,
  body: string,
) {
  secure(r);
  r.writeHead(200, {
    "content-type": `${mediaType}; charset=utf-8`,
    "content-disposition": `attachment; filename="${filename}"`,
  });
  r.end(body);
}
async function readBody(q: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of q) {
    const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
    size += b.length;
    if (size > 2_000_000) throw new Error("request_too_large");
    chunks.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid_json");
  }
}
async function readBinaryBody(q: IncomingMessage, maximumBytes=50_000_000){
  const chunks:Buffer[]=[]; let size=0;
  for await(const chunk of q){const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk); size+=value.length; if(size>maximumBytes) throw new Error("request_too_large"); chunks.push(value);}
  if(size===0) throw new Error("empty_upload");
  return Buffer.concat(chunks);
}
function staticPath(root: string, path: string) {
  const wanted = path === "/" ? "index.html" : path.slice(1);
  if (wanted.includes("\\") || wanted.includes("\0")) return null;
  const relative = normalize(wanted);
  if (isAbsolute(relative) || relative === ".." || relative.startsWith("../"))
    return null;
  return join(root, relative);
}
export function createResearchServer(input: {
  database: Pick<Pool, "query"> & Partial<Pick<Pool, "connect">>;
  publicDirectory: string;
  storageRoot?: string;
  now?: () => Date;
  acquire?: typeof acquireSource;
  acquireRendered?: typeof acquireRenderedSource;
  backgroundQueue?: boolean;
  aiProvider?:AiAnalysisProvider|null;
}) {
  const repo = new ResearchRepository(input.database),
    now = input.now ?? (() => new Date()),
    storageRoot = input.storageRoot ?? "storage",
    acquire = input.acquire ?? acquireSource;
  const renderedAcquire = input.acquireRendered ?? acquireRenderedSource;
  let aiProvider=input.aiProvider??null,aiConfiguration:AiProviderConfiguration|null=null;
  const aiUsage={requests:0,succeeded:0,failed:0,totalLatencyMs:0,lastUsedAt:null as string|null,lastError:null as string|null};
  const fetchAndPreserve = async (source: any, acquisition = acquire) => {
    const attemptId = randomUUID();
    await repo.beginRetrieval(
      attemptId,
      source.id,
      source.original_url,
      now().toISOString(),
    );
    try {
      const acquired = await acquisition(source.original_url),
        snapshotId = randomUUID(),
        unchanged = (await repo.latestHash(source.id)) === acquired.hash,
        storagePath = unchanged
          ? ""
          : await preserveSource(
              storageRoot,
              source.id,
              snapshotId,
              acquired.bytes,
              acquired.mediaType,
            );
      const outcome = await repo.completeRetrieval({
        attemptId,
        sourceId: source.id,
        snapshotId,
        at: now().toISOString(),
        resolvedUrl: acquired.resolvedUrl,
        status: acquired.status,
        hash: acquired.hash,
        mediaType: acquired.mediaType,
        byteLength: acquired.bytes.length,
        storagePath,
        metadata: acquired.metadata,
        unchanged,
      });
      return {
        ...outcome,
        hash: acquired.hash,
        mediaType: acquired.mediaType,
        byteLength: acquired.bytes.length,
        metadata: acquired.metadata,
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "retrieval_failed";
      await repo.failRetrieval(attemptId, source.id, now().toISOString(), code);
      throw error;
    }
  };
  const processQueue = async (studyId: string, maximumItems: number) => {
    const results = [];
    for (let index = 0; index < maximumItems; index += 1) {
      const item = await repo.claimAcquisition(studyId, now().toISOString());
      if (!item) break;
      try {
        const source = await repo.source(item.source_id);
        if (!source) throw new Error("source_not_found");
        const outcome = await fetchAndPreserve(source);
        await repo.finishAcquisitionQueue(item.id, now().toISOString());
        results.push({
          id: item.id,
          status: "succeeded",
          outcome: outcome.outcome,
        });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "retrieval_failed";
        await repo.failAcquisitionQueue(
          item.id,
          now().toISOString(),
          reason,
          item.attempts,
        );
        results.push({ id: item.id, status: "failed", reason });
      }
    }
    return results;
  };
  const processAnalysisItem=async()=>{
    const item=await repo.claimAnalysisItem(now().toISOString());if(!item)return null;
    try{
      const context=await repo.analysisJobContext(item);if(!context)throw new Error("analysis_input_unavailable");
      const {plan,source,sources,run}=context,type=item.analysis_type as string,isCorpus=item.scope_type==="corpus",ruleOnly=new Set(["syntax","readability"]),hybrid=new Set(["terminology","entities","sentiment","claims","comparison","contradictions","bias-framing","completeness","custom-extraction"]),output=analyseDeterministically(source.text_content,plan.expected_fields);
      const deterministicValue=type==="syntax"?output.syntax:type==="readability"?output.readability:type==="terminology"?{terms:output.terminology,facts:output.facts}:type==="completeness"?output.completeness:null;
      if(ruleOnly.has(type))await repo.saveAnalysisResult(run,source.source_id,type,"rules",parseAnalysisValue(type as AnalysisTypeId,deterministicValue),source.segment_ids,now().toISOString());
      else{
        if(!aiProvider)throw new Error("ai_provider_not_configured");
        let remaining=100_000;const evidence=isCorpus?balancedCorpusEvidence(sources):((source.evidence_segments as {segmentId:string;sourceId:string;content:string}[]).flatMap(item=>{if(remaining<=0)return[];const content=item.content.slice(0,remaining);remaining-=content.length;return content?[{...item,content}]:[]}));
        const instructions=`Perform ${type} analysis. Return a concise structured result. ${isCorpus?corpusInstructions(type,sources):""} ${plan.custom_questions.length?`Address these user questions when relevant: ${plan.custom_questions.join(" | ")}.`:""} ${plan.expected_fields.length?`Expected information: ${plan.expected_fields.join(", ")}.`:""} ${deterministicValue===null?"":`Deterministic observations to interpret, not override: ${JSON.stringify(deterministicValue)}`}`;
        const started=Date.now();aiUsage.requests++;aiUsage.lastUsedAt=now().toISOString();let result;
        try{result=await runGroundedAiAnalysis(aiProvider,{requestId:randomUUID(),analysisType:type,instructions,evidence,outputSchema:jsonSchemaForAnalysis(type as AnalysisTypeId,plan.expected_fields)});aiUsage.succeeded++;aiUsage.lastError=null;}
        catch(error){aiUsage.failed++;aiUsage.lastError=error instanceof Error?error.message:"analysis_failed";throw error;}
        finally{aiUsage.totalLatencyMs+=Date.now()-started;}
        if(await repo.analysisRunStatus(item.run_id)==="cancelled"){await repo.cancelAnalysisItem(item,now().toISOString());return{runId:item.run_id,itemId:item.id,status:"cancelled"};}
        const parsed=isCorpus?validateAnalysisSourceRelationships(type as AnalysisTypeId,result.value,sources.map((item:any)=>item.source_id)):parseAnalysisValue(type as AnalysisTypeId,result.value),method=hybrid.has(type)?"hybrid":"ai",payload=parseStoredAnalysisResult(type as AnalysisTypeId,method,deterministicValue===null?{interpretation:parsed,limitations:result.limitations}:{deterministic:deterministicValue,interpretation:parsed,limitations:result.limitations});
        await repo.saveAnalysisResult(run,isCorpus?null:source.source_id,type,method,payload,result.evidenceSegmentIds,now().toISOString(),{confidence:result.confidence,ruleVersion:deterministicValue===null?null:"deterministic-v1",model:{provider:aiProvider.id,model:aiProvider.model,promptVersion:"researched-grounded-v1",contractVersion:ANALYSIS_RESULT_CONTRACT_VERSION,scope:isCorpus?"corpus":"source",sourceIds:sources.map((item:any)=>item.source_id),hierarchy:context.hierarchy}});
      }
      if(await repo.analysisRunStatus(item.run_id)==="cancelled"){await repo.cancelAnalysisItem(item,now().toISOString());return{runId:item.run_id,itemId:item.id,status:"cancelled"};}
      await repo.completeAnalysisItem(item,now().toISOString());
      return{runId:item.run_id,itemId:item.id,status:"succeeded"};
    }catch(error){const reason=error instanceof Error?error.message:"analysis_failed",decision=analysisRetry(item.attempts,item.maximum_attempts,reason,now());await repo.failAnalysisItem(item,reason,decision.nextAttemptAt,now().toISOString(),!decision.retry);return{runId:item.run_id,itemId:item.id,status:decision.retry?"retrying":"failed",reason};}
  };
  let queueWorkerError: string | null = null;
  const server = createServer(async (q, r) => {
    const method = q.method ?? "GET",
      url = new URL(q.url ?? "/", "http://127.0.0.1"),
      path = url.pathname;
    try {
      if (path === "/api/health") {
        if (method !== "GET")
          return json(r, 405, { error: "method_not_allowed" });
        try {
          const ready =
            (
              await input.database.query(
                "SELECT to_regclass('researched.studies') IS NOT NULL AS ready",
              )
            ).rows[0]?.ready === true;
          return json(
            r,
            ready ? 200 : 503,
            createApplicationHealth({
              application: "researched",
              status: ready && !queueWorkerError ? "healthy" : "degraded",
              observedAt: now().toISOString(),
              components: [
                { id: "research-core", status: ready ? "healthy" : "degraded" },
                {
                  id: "acquisition-worker",
                  status: queueWorkerError ? "degraded" : "healthy",
                  ...(queueWorkerError ? { detail: queueWorkerError } : {}),
                },
              ],
            }),
          );
        } catch {
          return json(
            r,
            503,
            createApplicationHealth({
              application: "researched",
              status: "unavailable",
              observedAt: now().toISOString(),
              components: [{ id: "database", status: "unavailable" }],
            }),
          );
        }
      }
      if (path === "/api/application" && method === "GET")
        return json(r, 200, {
          id: "researched",
          name: "Research'Ed",
          foundation: "research-core",
          functions: [
            "study-designer",
            "corpus-manager",
            "entity-modelling",
            "source-archive",
            "source-extraction",
            "evidence-capture",
            "cross-source-analysis",
            "findings",
            "reporting",
            "research-lifecycle",
            "audit-history",
            "evidence-search",
            "source-discovery",
            "acquisition-queue",
            "browser-rendering",
            "pdf-ocr",
            "analysis-planner",
            "deterministic-analysis",
            "human-analysis-review",
            "background-analysis-jobs",
            "guided-analysis-setup",
            "analysis-templates",
            "analysis-result-export",
            "research-insights",
            "batch-source-intake",
            "document-upload",
            "interactive-content-expansion",
          ],
        });
      if (path === "/api/capabilities" && method === "GET")
        return json(r, 200, {
          browserRendering: {
            available: Boolean(findBrowserExecutable()),
            engine: findBrowserExecutable() ? "system Chromium/Edge" : null,
          },
          pdfOcr: { available: true, language: "English", local: true },
          backgroundAcquisition: {
            available: Boolean(input.backgroundQueue),
            intervalSeconds: 15,
          },
          aiAnalysis:{available:Boolean(aiProvider),provider:aiProvider?.id??null,model:aiProvider?.model??null,usage:{...aiUsage,averageLatencyMs:aiUsage.requests?Math.round(aiUsage.totalLatencyMs/aiUsage.requests):null}},
        });
      if (path === "/api/analysis-types" && method === "GET")
        return json(r,200,{items:ANALYSIS_CATALOG});
      const analysisContractMatch=/^\/api\/analysis-types\/([a-z-]+)\/contract$/i.exec(path);
      if(analysisContractMatch&&method==="GET"){
        const type=analysisContractMatch[1] as AnalysisTypeId;if(!analysisResultJsonSchemas[type])return json(r,404,{error:"analysis_type_not_found"});
        return json(r,200,{contractVersion:ANALYSIS_RESULT_CONTRACT_VERSION,analysisType:type,schema:analysisResultJsonSchemas[type]});
      }
      if(path==="/api/ai/providers"&&method==="GET") return json(r,200,{items:AI_PROVIDER_PROTOCOLS,configured:aiProvider?{protocol:aiProvider.id,model:aiProvider.model}:null,configuration:{protocol:"RESEARCHED_AI_PROTOCOL",model:"RESEARCHED_AI_MODEL",baseUrl:"RESEARCHED_AI_BASE_URL",apiKey:"RESEARCHED_AI_API_KEY"}});
      if(path==="/api/ai/connection"){
        if(method==="POST"){const value=aiConnectionInput.parse(await readBody(q));aiConfiguration={protocol:value.protocol,model:value.model,baseUrl:value.baseUrl,...(value.apiKey?{apiKey:value.apiKey}:{})};aiProvider=createAiAnalysisProvider(aiConfiguration);return json(r,200,{configured:true,protocol:aiProvider.id,model:aiProvider.model,persistence:"memory-only"});}
        if(method==="DELETE"){aiProvider=null;aiConfiguration=null;return json(r,200,{configured:false});}
        return json(r,405,{error:"method_not_allowed"});
      }
      if(path==="/api/ai/inspect"&&method==="POST"){
        const value=aiDiscoveryInput.parse(await readBody(q)),configuration:AiProviderConfiguration={protocol:value.protocol,model:value.model,baseUrl:value.baseUrl,...(value.apiKey?{apiKey:value.apiKey}:{})};
        const diagnostic=await inspectAiConnection(configuration);
        return json(r,diagnostic.status==="unavailable"?422:200,diagnostic);
      }
      if(path==="/api/ai/usage"&&method==="GET")return json(r,200,{provider:aiProvider?.id??null,model:aiProvider?.model??null,...aiUsage,averageLatencyMs:aiUsage.requests?Math.round(aiUsage.totalLatencyMs/aiUsage.requests):null});
      if (path === "/api/analysis-plans") {
        if(method === "GET") return json(r,200,{items:await repo.analysisPlans(String(url.searchParams.get("studyId")??""))});
        if(method === "POST") return json(r,201,await repo.createAnalysisPlan(randomUUID(),analysisPlanInput.parse(await readBody(q)),now().toISOString()));
        return json(r,405,{error:"method_not_allowed"});
      }
      if(path==="/api/analysis-templates"){
        if(method==="GET")return json(r,200,{items:await repo.analysisTemplates()});
        if(method==="POST")return json(r,201,await repo.createAnalysisTemplate(randomUUID(),analysisTemplateInput.parse(await readBody(q)),now().toISOString()));
        return json(r,405,{error:"method_not_allowed"});
      }
      const analysisTemplateMatch=/^\/api\/analysis-templates\/([0-9a-f-]{36})$/i.exec(path);
      if(analysisTemplateMatch){if(method!=="DELETE")return json(r,405,{error:"method_not_allowed"});return(await repo.deleteAnalysisTemplate(analysisTemplateMatch[1]!))?json(r,200,{deleted:true}):json(r,404,{error:"analysis_template_not_found"});}
      if (path === "/api/analysis-runs" && method === "GET")
        return json(r,200,{items:await repo.analysisRuns(String(url.searchParams.get("studyId")??""))});
      const analysisPlanRunMatch=/^\/api\/analysis-plans\/([0-9a-f-]{36})\/run$/i.exec(path);
      if(analysisPlanRunMatch){
        if(method!=="POST") return json(r,405,{error:"method_not_allowed"});
        const request=analysisRunInput.parse(await readBody(q)),plan=await repo.analysisPlan(analysisPlanRunMatch[1]!);
        if(!plan) return json(r,404,{error:"analysis_plan_not_found"});
        const inputs=await repo.analysisInputs(plan.study_id,plan.source_ids);if(!inputs.length)return json(r,409,{error:"analysis_has_no_extracted_sources"});if((plan.analysis_types as string[]).some(type=>["themes","comparison","contradictions"].includes(type))&&inputs.length<2)return json(r,409,{error:"cross_source_analysis_requires_two_sources"});
        const run=await repo.beginAnalysisRun(randomUUID(),plan,request.actor,inputs,request.maximumAttempts,now().toISOString());
        return json(r,202,{...run,execution:"background",message:"Analysis queued. You may leave this screen while it runs."});
      }
      const analysisRunMatch=/^\/api\/analysis-runs\/([0-9a-f-]{36})$/i.exec(path);
      if(analysisRunMatch){if(method!=="GET") return json(r,405,{error:"method_not_allowed"}); const result=await repo.analysisRun(analysisRunMatch[1]!); return result?json(r,200,result):json(r,404,{error:"analysis_run_not_found"});}
      const analysisExportMatch=/^\/api\/analysis-runs\/([0-9a-f-]{36})\/export$/i.exec(path);
      if(analysisExportMatch){if(method!=="GET")return json(r,405,{error:"method_not_allowed"});const run=await repo.analysisRun(analysisExportMatch[1]!);if(!run)return json(r,404,{error:"analysis_run_not_found"});const format=url.searchParams.get("format")??"json";if(format==="csv")return documentResponse(r,"text/csv",`analysis-${run.id}.csv`,analysisRunCsv(run));if(format==="markdown")return documentResponse(r,"text/markdown",`analysis-${run.id}.md`,analysisRunMarkdown(run));if(format==="json")return documentResponse(r,"application/json",`analysis-${run.id}.json`,analysisRunArchive(run));return json(r,400,{error:"unsupported_export_format"});}
      const analysisControlMatch=/^\/api\/analysis-runs\/([0-9a-f-]{36})\/(pause|resume|cancel|retry)$/i.exec(path);
      if(analysisControlMatch){if(method!=="POST")return json(r,405,{error:"method_not_allowed"});analysisRunControlInput.parse(await readBody(q));const result=await repo.controlAnalysisRun(analysisControlMatch[1]!,analysisControlMatch[2]!.toLowerCase() as "pause"|"resume"|"cancel"|"retry",now().toISOString());return result?json(r,200,result):json(r,409,{error:"invalid_analysis_run_transition"});}
      const analysisResultMatch=/^\/api\/analysis-results\/([0-9a-f-]{36})$/i.exec(path);
      if(analysisResultMatch){if(method!=="PATCH") return json(r,405,{error:"method_not_allowed"});const decision=analysisFindingDecisionInput.parse(await readBody(q)),existing=await repo.analysisResult(analysisResultMatch[1]!);if(!existing)return json(r,404,{error:"analysis_result_not_found"});if(decision.status==="amended")decision.amendedValue=parseStoredAnalysisResult(existing.analysis_type as AnalysisTypeId,existing.method,decision.amendedValue);const result=await repo.decideAnalysisResult(analysisResultMatch[1]!,decision,now().toISOString());return json(r,200,result);}
      if (path === "/api/dashboard" && method === "GET")
        return json(r, 200, await repo.counts());
      if(path==="/api/insights"&&method==="GET"){const studyId=String(url.searchParams.get("studyId")??"");if(!studyId)return json(r,400,{error:"study_id_required"});return json(r,200,buildResearchInsights(await repo.researchInsightMetrics(studyId)));}
      if(path==="/api/sources/batch"){
        if(method!=="POST") return json(r,405,{error:"method_not_allowed"});
        const value=batchSourceInput.parse(await readBody(q)),items=[] as any[],failures=[] as any[];
        for(const originalUrl of [...new Set(value.urls)]){
          try{
            const parsed=new URL(originalUrl),pathname=parsed.pathname.toLowerCase(),sourceType=pathname.endsWith(".pdf")?"pdf":pathname.endsWith(".docx")||pathname.endsWith(".doc")?"document":"webpage";
            items.push(await repo.createSource(randomUUID(),{studyId:value.studyId,label:decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1)??parsed.hostname),originalUrl,sourceType,authority:value.authority,corpusStatus:value.corpusStatus,completeness:"unassessed"},now().toISOString()));
          }catch(error){failures.push({url:originalUrl,error:error instanceof Error?error.message:"source_add_failed"});}
        }
        return json(r,failures.length?207:201,{created:items,failures,requested:value.urls.length});
      }
      const uploadMatch=/^\/api\/studies\/([0-9a-f-]{36})\/uploads$/i.exec(path);
      if(uploadMatch){
        if(method!=="POST") return json(r,405,{error:"method_not_allowed"});
        const filename=decodeURIComponent(String(url.searchParams.get("filename")??"")).trim();
        if(!filename||filename.length>500) return json(r,400,{error:"invalid_filename"});
        const mediaType=String(q.headers["content-type"]??"application/octet-stream").split(";")[0]!.toLowerCase();
        const extension=filename.toLowerCase().split(".").at(-1), supported=mediaType==="application/pdf"||mediaType==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"||mediaType.startsWith("text/")||["pdf","docx","txt","html","htm"].includes(extension??"");
        if(!supported) return json(r,415,{error:"unsupported_upload_type"});
        const bytes=await readBinaryBody(q),sourceId=randomUUID(),snapshotId=randomUUID(),at=now().toISOString();
        const sourceType=mediaType==="application/pdf"||extension==="pdf"?"pdf":extension==="docx"||mediaType.includes("wordprocessingml")?"document":"other";
        const source=await repo.createSource(sourceId,{studyId:uploadMatch[1]!,label:filename,originalUrl:`upload://${sourceId}/${encodeURIComponent(filename)}`,sourceType,authority:"unknown",corpusStatus:"pending",completeness:"unassessed",notes:"Uploaded local document"},at);
        const attemptId=randomUUID(); await repo.beginRetrieval(attemptId,sourceId,source.original_url,at);
        const hash=contentHash(bytes),storagePath=await preserveSource(storageRoot,sourceId,snapshotId,bytes,mediaType);
        const outcome=await repo.completeRetrieval({attemptId,sourceId,snapshotId,at,resolvedUrl:source.original_url,status:200,hash,mediaType,byteLength:bytes.length,storagePath,metadata:{uploaded:true,filename},unchanged:false});
        return json(r,201,{source:{...source,retrieval_status:"available"},outcome});
      }
      if (path === "/api/research-codes") {
        if (method === "GET")
          return json(r, 200, {
            items: await repo.researchCodes(
              String(url.searchParams.get("studyId") ?? ""),
            ),
          });
        if (method === "POST")
          return json(
            r,
            201,
            await repo.createResearchCode(
              randomUUID(),
              researchCodeInput.parse(await readBody(q)),
              now().toISOString(),
            ),
          );
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/evidence") {
        if (method === "GET")
          return json(
            r,
            200,
            await repo.evidence(String(url.searchParams.get("studyId") ?? ""), {
              query: String(url.searchParams.get("q") ?? ""),
              status: String(url.searchParams.get("status") ?? ""),
              evidenceType: String(url.searchParams.get("type") ?? ""),
              codeId: String(url.searchParams.get("codeId") ?? ""),
              limit: Math.min(
                50,
                Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
              ),
              offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0)),
            }),
          );
        if (method === "POST") {
          const value = evidenceInput.parse(await readBody(q));
          const context = await repo.segmentContext(value.segmentId);
          if (!context) return json(r, 404, { error: "segment_not_found" });
          if (context.study_id !== value.studyId)
            return json(r, 400, { error: "invalid_evidence_relationship" });
          return json(
            r,
            201,
            await repo.createEvidence(
              randomUUID(),
              value,
              context,
              now().toISOString(),
            ),
          );
        }
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/analysis" && method === "GET")
        return json(
          r,
          200,
          await repo.analysis(String(url.searchParams.get("studyId") ?? "")),
        );
      if (path === "/api/findings") {
        if (method === "GET")
          return json(
            r,
            200,
            await repo.findings(String(url.searchParams.get("studyId") ?? ""), {
              query: String(url.searchParams.get("q") ?? ""),
              status: String(url.searchParams.get("status") ?? ""),
              limit: Math.min(
                50,
                Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
              ),
              offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0)),
            }),
          );
        if (method === "POST")
          return json(
            r,
            201,
            await repo.createFinding(
              randomUUID(),
              findingInput.parse(await readBody(q)),
              now().toISOString(),
            ),
          );
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/reports") {
        if (method === "GET")
          return json(r, 200, {
            items: await repo.reports(
              String(url.searchParams.get("studyId") ?? ""),
            ),
          });
        if (method === "POST") {
          const value = reportInput.parse(await readBody(q));
          const data = await repo.reportData(value.studyId, value.findingIds);
          if (!data) return json(r, 404, { error: "study_not_found" });
          const generatedAt = now().toISOString();
          const assembled = assembleReport(value, data, generatedAt);
          return json(
            r,
            201,
            await repo.saveReport(
              randomUUID(),
              value,
              assembled.payload,
              assembled.hash,
              generatedAt,
            ),
          );
        }
        return json(r, 405, { error: "method_not_allowed" });
      }
      const reportMatch = /^\/api\/reports\/([0-9a-f-]{36})$/i.exec(path);
      if (reportMatch) {
        if (method !== "GET")
          return json(r, 405, { error: "method_not_allowed" });
        const report = await repo.report(reportMatch[1]!);
        return report
          ? json(r, 200, report)
          : json(r, 404, { error: "report_not_found" });
      }
      const reportExportMatch =
        /^\/api\/reports\/([0-9a-f-]{36})\/export$/i.exec(path);
      if (reportExportMatch) {
        if (method !== "GET")
          return json(r, 405, { error: "method_not_allowed" });
        const report = await repo.report(reportExportMatch[1]!);
        if (!report) return json(r, 404, { error: "report_not_found" });
        const format = url.searchParams.get("format") ?? "html";
        if (format === "html")
          return documentResponse(
            r,
            "text/html",
            `researched-report-${report.id}.html`,
            renderReportHtml(report),
          );
        if (format === "json")
          return documentResponse(
            r,
            "application/json",
            `researched-report-${report.id}.json`,
            JSON.stringify(report, null, 2),
          );
        return json(r, 400, { error: "unsupported_report_format" });
      }
      const readinessMatch =
        /^\/api\/studies\/([0-9a-f-]{36})\/readiness$/i.exec(path);
      if (readinessMatch) {
        if (method !== "GET")
          return json(r, 405, { error: "method_not_allowed" });
        const readiness = await repo.studyReadiness(readinessMatch[1]!);
        return readiness
          ? json(r, 200, readiness)
          : json(r, 404, { error: "study_not_found" });
      }
      const studyMatch = /^\/api\/studies\/([0-9a-f-]{36})$/i.exec(path);
      if (studyMatch) {
        if (method !== "PATCH")
          return json(r, 405, { error: "method_not_allowed" });
        const value = studyTransitionInput.parse(await readBody(q));
        const updated = await repo.transitionStudy(
          studyMatch[1]!,
          value.targetStatus,
          value.actor,
          value.reason,
          now().toISOString(),
        );
        return updated
          ? json(r, 200, updated)
          : json(r, 404, { error: "study_not_found" });
      }
      const evidenceMatch = /^\/api\/evidence\/([0-9a-f-]{36})$/i.exec(path);
      if (evidenceMatch) {
        if (method !== "PATCH")
          return json(r, 405, { error: "method_not_allowed" });
        const value = evidenceTransitionInput.parse(await readBody(q));
        const updated = await repo.transitionEvidence(
          evidenceMatch[1]!,
          value.targetStatus,
          value.actor,
          value.reason,
          now().toISOString(),
        );
        return updated
          ? json(r, 200, updated)
          : json(r, 404, { error: "evidence_not_found" });
      }
      const findingMatch = /^\/api\/findings\/([0-9a-f-]{36})$/i.exec(path);
      if (findingMatch) {
        if (method !== "PATCH")
          return json(r, 405, { error: "method_not_allowed" });
        const value = findingTransitionInput.parse(await readBody(q));
        const updated = await repo.transitionFinding(
          findingMatch[1]!,
          value.targetStatus,
          value.actor,
          value.reason,
          now().toISOString(),
        );
        return updated
          ? json(r, 200, updated)
          : json(r, 404, { error: "finding_not_found" });
      }
      if (path === "/api/audit" && method === "GET") {
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
        );
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        return json(r, 200, {
          items: await repo.auditTrail(
            String(url.searchParams.get("studyId") ?? ""),
            limit,
            offset,
          ),
          limit,
          offset,
        });
      }
      if (path === "/api/studies") {
        if (method === "GET")
          return json(r, 200, { items: await repo.studies() });
        if (method === "POST")
          return json(
            r,
            201,
            await repo.createStudy(
              randomUUID(),
              studyInput.parse(await readBody(q)),
              now().toISOString(),
            ),
          );
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/entity-types") {
        if (method === "GET")
          return json(r, 200, {
            items: await repo.entityTypes(
              String(url.searchParams.get("studyId") ?? ""),
            ),
          });
        if (method === "POST")
          return json(
            r,
            201,
            await repo.createEntityType(
              randomUUID(),
              entityTypeInput.parse(await readBody(q)),
              now().toISOString(),
            ),
          );
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/entities") {
        if (method === "GET")
          return json(r, 200, {
            items: await repo.entities(
              String(url.searchParams.get("studyId") ?? ""),
            ),
          });
        if (method === "POST")
          return json(
            r,
            201,
            await repo.createEntity(
              randomUUID(),
              entityInput.parse(await readBody(q)),
              now().toISOString(),
            ),
          );
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/sources") {
        if (method === "GET") {
          const limit = Math.min(
              50,
              Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
            ),
            offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
          return json(
            r,
            200,
            await repo.sources(
              String(url.searchParams.get("studyId") ?? ""),
              limit,
              offset,
            ),
          );
        }
        if (method === "POST")
          return json(
            r,
            201,
            await repo.createSource(
              randomUUID(),
              sourceInput.parse(await readBody(q)),
              now().toISOString(),
            ),
          );
        return json(r, 405, { error: "method_not_allowed" });
      }
      const sourceMatch = /^\/api\/sources\/([0-9a-f-]{36})$/i.exec(path);
      if (sourceMatch) {
        if (method !== "PATCH")
          return json(r, 405, { error: "method_not_allowed" });
        const updated = await repo.decideSource(
          sourceMatch[1]!,
          sourceDecision.parse(await readBody(q)),
          now().toISOString(),
        );
        return updated
          ? json(r, 200, updated)
          : json(r, 404, { error: "source_not_found" });
      }
      const snapshots = /^\/api\/sources\/([0-9a-f-]{36})\/snapshots$/i.exec(
        path,
      );
      if (snapshots) {
        if (method !== "GET")
          return json(r, 405, { error: "method_not_allowed" });
        return json(r, 200, { items: await repo.snapshots(snapshots[1]!) });
      }
      const extractionMatch =
        /^\/api\/snapshots\/([0-9a-f-]{36})\/extraction$/i.exec(path);
      if (extractionMatch) {
        const snapshot = await repo.snapshot(extractionMatch[1]!);
        if (!snapshot) return json(r, 404, { error: "snapshot_not_found" });
        if (method === "GET") {
          const extraction = await repo.extraction(snapshot.id);
          return extraction
            ? json(r, 200, extraction)
            : json(r, 404, { error: "extraction_not_found" });
        }
        if (method === "POST") {
          try {
            const existing = await repo.extraction(snapshot.id);
            const useOcr = url.searchParams.get("ocr") === "true";
            if (existing && !(useOcr && existing.status === "empty"))
              return json(r, 200, existing);
            const result = await extractStoredSnapshot(
              storageRoot,
              snapshot.storage_path,
              snapshot.media_type,
              { ocr: useOcr },
            );
            const saved = await repo.saveExtraction(
              randomUUID(),
              snapshot.id,
              result,
              now().toISOString(),
              useOcr,
            );
            return json(r, result.status === "completed" ? 201 : 200, saved);
          } catch (error) {
            const reason =
              error instanceof Error ? error.message : "extraction_failed";
            return json(r, 422, { error: "extraction_failed", reason });
          }
        }
        return json(r, 405, { error: "method_not_allowed" });
      }
      const fetchMatch = /^\/api\/sources\/([0-9a-f-]{36})\/fetch$/i.exec(path);
      const renderedFetchMatch =
        /^\/api\/sources\/([0-9a-f-]{36})\/render-fetch$/i.exec(path);
      if (renderedFetchMatch) {
        if (method !== "POST")
          return json(r, 405, { error: "method_not_allowed" });
        const source = await repo.source(renderedFetchMatch[1]!);
        if (!source) return json(r, 404, { error: "source_not_found" });
        try {
          const options=renderedFetchInput.parse(await readBody(q));
          const outcome = await fetchAndPreserve(source,(requestedUrl)=>renderedAcquire(requestedUrl,{expandInteractiveContent:options.expandInteractiveContent,maximumInteractions:options.maximumInteractions}));
          return json(r, outcome.outcome === "unchanged" ? 200 : 201, outcome);
        } catch (error) {
          return json(r, 422, {
            error: "rendered_retrieval_failed",
            reason: error instanceof Error ? error.message : "retrieval_failed",
          });
        }
      }
      const discoverMatch = /^\/api\/sources\/([0-9a-f-]{36})\/discover$/i.exec(
        path,
      );
      if (discoverMatch) {
        if (method !== "POST")
          return json(r, 405, { error: "method_not_allowed" });
        const options = discoveryInput.parse(await readBody(q));
        const snapshots = await repo.snapshots(discoverMatch[1]!);
        if (!snapshots[0]) return json(r, 404, { error: "snapshot_not_found" });
        const snapshot = await repo.snapshot(snapshots[0].id);
        if (!snapshot) return json(r, 404, { error: "snapshot_not_found" });
        const links = await discoverStoredLinks(
          storageRoot,
          snapshot.storage_path,
          snapshot.media_type,
          snapshot.resolved_url || snapshot.original_url,
          { sameOrigin: options.sameOrigin, maximum: options.maximumLinks },
        );
        return json(
          r,
          201,
          await repo.saveDiscoveredLinks(snapshot, links, now().toISOString()),
        );
      }
      if (path === "/api/discovered-links" && method === "GET") {
        const limit = Math.min(
            50,
            Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
          ),
          offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        return json(
          r,
          200,
          await repo.discoveredLinks(
            String(url.searchParams.get("studyId") ?? ""),
            String(url.searchParams.get("status") ?? ""),
            limit,
            offset,
          ),
        );
      }
      const discoveryMatch = /^\/api\/discovered-links\/([0-9a-f-]{36})$/i.exec(
        path,
      );
      if (discoveryMatch) {
        if (method !== "PATCH")
          return json(r, 405, { error: "method_not_allowed" });
        const updated = await repo.decideDiscoveredLink(
          discoveryMatch[1]!,
          discoveryDecisionInput.parse(await readBody(q)),
          now().toISOString(),
        );
        return updated
          ? json(r, 200, updated)
          : json(r, 404, { error: "discovered_link_not_found" });
      }
      if (path === "/api/acquisition-queue") {
        if (method === "GET")
          return json(r, 200, {
            items: await repo.acquisitionQueue(
              String(url.searchParams.get("studyId") ?? ""),
            ),
          });
        if (method === "POST") {
          const value = queueInput.parse(await readBody(q));
          return json(
            r,
            201,
            await repo.enqueueSources(
              value.studyId,
              value.sourceIds,
              value.maximumAttempts,
              now().toISOString(),
            ),
          );
        }
        return json(r, 405, { error: "method_not_allowed" });
      }
      if (path === "/api/acquisition-queue/run" && method === "POST") {
        const value = queueRunInput.parse(await readBody(q));
        const results = await processQueue(value.studyId, value.maximumItems);
        return json(r, 200, { processed: results.length, results });
      }
      const cancelQueueMatch =
        /^\/api\/acquisition-queue\/([0-9a-f-]{36})\/cancel$/i.exec(path);
      if (cancelQueueMatch) {
        if (method !== "POST")
          return json(r, 405, { error: "method_not_allowed" });
        const cancelled = await repo.cancelAcquisition(
          cancelQueueMatch[1]!,
          now().toISOString(),
        );
        return cancelled
          ? json(r, 200, cancelled)
          : json(r, 409, { error: "queue_item_not_cancellable" });
      }
      if (fetchMatch) {
        if (method !== "POST")
          return json(r, 405, { error: "method_not_allowed" });
        const source = await repo.source(fetchMatch[1]!);
        if (!source) return json(r, 404, { error: "source_not_found" });
        try {
          const outcome = await fetchAndPreserve(source);
          return json(r, outcome.outcome === "unchanged" ? 200 : 201, {
            ...outcome,
          });
        } catch (error) {
          const code =
            error instanceof Error ? error.message : "retrieval_failed";
          return json(r, 422, { error: "retrieval_failed", reason: code });
        }
      }
    } catch (error) {
      if (error instanceof ZodError)
        return json(r, 400, {
          error: "validation_failed",
          issues: error.issues,
        });
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (code === "23505") return json(r, 409, { error: "already_exists" });
      if (code === "23503")
        return json(r, 400, { error: "invalid_relationship" });
      if (error instanceof Error && error.message === "invalid_evidence_codes")
        return json(r, 400, { error: "invalid_evidence_codes" });
      if (
        error instanceof Error &&
        error.message === "invalid_finding_evidence"
      )
        return json(r, 400, { error: "invalid_finding_evidence" });
      if (error instanceof Error && error.message === "invalid_report_findings")
        return json(r, 400, { error: "invalid_report_findings" });
      if (
        error instanceof Error &&
        [
          "invalid_study_transition",
          "invalid_status_transition",
          "transition_reason_required",
          "study_not_ready",
          "concurrent_transition",
          "study_read_only",
          "discovery_already_decided",
          "invalid_queue_sources",
        ].includes(error.message)
      )
        return json(r, 409, { error: error.message });
      if (
        error instanceof Error &&
        ["link_discovery_requires_html", "invalid_snapshot_path"].includes(
          error.message,
        )
      )
        return json(r, 422, { error: error.message });
      return json(r, 500, { error: "internal_error" });
    }
    if (method !== "GET" && method !== "HEAD")
      return json(r, 405, { error: "method_not_allowed" });
    const file = staticPath(input.publicDirectory, path);
    if (!file || ![".html", ".js", ".css"].includes(extname(file)))
      return json(r, 404, { error: "not_found" });
    secure(r);
    r.setHeader(
      "content-type",
      extname(file) === ".html"
        ? "text/html; charset=utf-8"
        : extname(file) === ".css"
          ? "text/css; charset=utf-8"
          : "text/javascript; charset=utf-8",
    );
    if (method === "HEAD") return r.end();
    const stream = createReadStream(file);
    stream.once("error", () => {
      if (!r.headersSent) json(r, 404, { error: "not_found" });
      else r.destroy();
    });
    stream.pipe(r);
  });
  void repo.recoverAnalysisJobs(now().toISOString()).catch((error)=>{queueWorkerError=error instanceof Error?error.message:"analysis_recovery_failed";});
  let analysisWorkerBusy=false;
  const analysisTimer=input.backgroundQueue?setInterval(()=>{if(analysisWorkerBusy)return;analysisWorkerBusy=true;Promise.all([processAnalysisItem(),processAnalysisItem()]).then(()=>{queueWorkerError=null;}).catch((error)=>{queueWorkerError=error instanceof Error?error.message:"analysis_worker_failed";}).finally(()=>{analysisWorkerBusy=false;});},1_000):null;
  analysisTimer?.unref();
  const timer = input.backgroundQueue
    ? setInterval(() => {
        void repo
          .queuedStudyIds()
          .then(async (studyIds) => {
            for (const studyId of studyIds) await processQueue(studyId, 2);
            queueWorkerError = null;
          })
          .catch((error) => {
            queueWorkerError =
              error instanceof Error ? error.message : "queue_worker_failed";
          });
      }, 15_000)
    : null;
  timer?.unref();
  server.once("close", () => {
    if (timer) clearInterval(timer);
    if (analysisTimer) clearInterval(analysisTimer);
  });
  return server;
}
export async function startResearchApi(env: NodeJS.ProcessEnv) {
  const c = loadConfig(env),
    database = new pg.Pool({ connectionString: c.databaseUrl }),
    server = createResearchServer({
      database,
      publicDirectory: join(c.appRoot, "dist/frontend"),
      storageRoot: c.storageRoot,
      backgroundQueue: true,
      aiProvider:c.ai?createAiAnalysisProvider(c.ai):null,
    });
  server.on("close", () => void database.end());
  server.listen(c.port, "127.0.0.1", () =>
    process.stdout.write(`Research'Ed: http://127.0.0.1:${c.port}\n`),
  );
  const stop = () => server.close();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href)
  startResearchApi(process.env).catch((e) => {
    process.stderr.write(
      `${e instanceof Error ? e.message : "Research'Ed startup failed"}\n`,
    );
    process.exitCode = 1;
  });
