import { z } from "zod";
export const groundedAnalysisResponse=z.object({value:z.unknown(),confidence:z.number().min(0).max(1),evidenceSegmentIds:z.array(z.string().uuid()).min(1),limitations:z.array(z.string()).default([])}).strict();
export interface AnalysisEvidence{segmentId:string;sourceId:string;content:string}
export interface AiAnalysisRequest{requestId:string;analysisType:string;instructions:string;evidence:readonly AnalysisEvidence[];outputSchema?:Record<string,unknown>}
export interface AiAnalysisProvider{readonly id:string;readonly model:string;analyse(request:AiAnalysisRequest):Promise<z.infer<typeof groundedAnalysisResponse>>}
export type AiProtocol="openai-responses"|"openai-chat"|"anthropic-messages"|"generic-json";
export const AI_PROVIDER_PROTOCOLS=[
  {id:"openai-responses",name:"OpenAI Responses",description:"OpenAI and services implementing the Responses API.",defaultBaseUrl:"https://api.openai.com",requiresKey:true},
  {id:"openai-chat",name:"OpenAI-compatible chat",description:"OpenRouter, Groq, compatible hosted services, Ollama and LM Studio.",defaultBaseUrl:"https://api.openai.com",requiresKey:"provider-dependent"},
  {id:"anthropic-messages",name:"Anthropic Messages",description:"Anthropic Claude and compatible Messages APIs.",defaultBaseUrl:"https://api.anthropic.com",requiresKey:true},
  {id:"generic-json",name:"TimSyS JSON webhook",description:"Any model or gateway adapted to the documented TimSyS request and response contract.",defaultBaseUrl:null,requiresKey:"provider-dependent"},
] as const;
export interface AiProviderConfiguration{protocol:AiProtocol;model:string;baseUrl:string;apiKey?:string;timeoutMs?:number;fetch?:typeof fetch}
export interface AiConnectionDiagnostic{status:"available"|"unavailable"|"unsupported";latencyMs:number|null;models:string[];detail:string}
const resultSchema=(value:Record<string,unknown>={type:"object",additionalProperties:true})=>({type:"object",additionalProperties:false,required:["value","confidence","evidenceSegmentIds","limitations"],properties:{value,confidence:{type:"number",minimum:0,maximum:1},evidenceSegmentIds:{type:"array",minItems:1,items:{type:"string"}},limitations:{type:"array",items:{type:"string"}}}});
const systemInstruction="Use only the supplied evidence. Return valid JSON matching the requested schema. Cite only supplied segmentId values. State limitations rather than guessing.";
function safeEndpoint(baseUrl:string,path:string,protocol:AiProtocol){const endpoint=new URL(path,baseUrl),local=["localhost","127.0.0.1","::1"].includes(endpoint.hostname);if(endpoint.protocol!=="https:"&&!(local&&endpoint.protocol==="http:"))throw new Error("ai_provider_requires_https_or_loopback");if(protocol==="generic-json"&&endpoint.pathname==="/")throw new Error("generic_ai_endpoint_path_required");return endpoint}
function jsonText(value:string){return groundedAnalysisResponse.parse(JSON.parse(value.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/, "")))}
async function boundedJson(response:Response){if(!response.ok)throw new Error(`ai_provider_http_${response.status}`);const declared=Number(response.headers.get("content-length")??0);if(declared>2_000_000)throw new Error("ai_provider_response_too_large");const text=await response.text();if(Buffer.byteLength(text)>2_000_000)throw new Error("ai_provider_response_too_large");try{return JSON.parse(text)}catch{throw new Error("ai_provider_invalid_json")}}
function discoveryRequest(configuration:AiProviderConfiguration){
  if(configuration.protocol==="generic-json") return null;
  const anthropic=configuration.protocol==="anthropic-messages";
  const endpoint=safeEndpoint(configuration.baseUrl,"/v1/models",configuration.protocol);
  const headers:Record<string,string>={Accept:"application/json"};
  if(configuration.apiKey){if(anthropic){headers["x-api-key"]=configuration.apiKey;headers["anthropic-version"]="2023-06-01";}else headers.Authorization=`Bearer ${configuration.apiKey}`;}
  return {endpoint,headers};
}
export async function inspectAiConnection(configuration:AiProviderConfiguration):Promise<AiConnectionDiagnostic>{
  createAiAnalysisProvider(configuration);
  const request=discoveryRequest(configuration);
  if(!request)return{status:"unsupported",latencyMs:null,models:[],detail:"This custom endpoint does not advertise a standard model catalogue. Its connection is validated when an analysis runs."};
  const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),configuration.timeoutMs??15_000);
  try{
    const response=await(configuration.fetch??fetch)(request.endpoint,{method:"GET",redirect:"error",signal:controller.signal,headers:request.headers});
    const body:any=await boundedJson(response),items=Array.isArray(body.data)?body.data:Array.isArray(body.models)?body.models:[];
    const models=items.map((item:any)=>typeof item==="string"?item:item?.id??item?.name).filter((item:unknown):item is string=>typeof item==="string").sort();
    return{status:"available",latencyMs:Date.now()-started,models,detail:models.length?`${models.length} model(s) available.`:"Provider responded successfully but returned no model names."};
  }catch(error){return{status:"unavailable",latencyMs:Date.now()-started,models:[],detail:error instanceof Error?error.message:"Provider connection failed."};}
  finally{clearTimeout(timer)}
}
abstract class HttpAnalysisProvider implements AiAnalysisProvider{
  abstract readonly id:string;
  constructor(readonly model:string,protected readonly options:AiProviderConfiguration){}
  protected async post(endpoint:URL,body:unknown,headers:Record<string,string>={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??90_000);try{return await boundedJson(await(this.options.fetch??fetch)(endpoint,{method:"POST",redirect:"error",signal:controller.signal,headers:{"Content-Type":"application/json",Accept:"application/json",...headers},body:JSON.stringify(body)}))}finally{clearTimeout(timer)}}
  abstract analyse(request:AiAnalysisRequest):Promise<z.infer<typeof groundedAnalysisResponse>>;
}
export class OpenAiResponsesAnalysisProvider extends HttpAnalysisProvider{
  readonly id="openai-responses";
  constructor(model:string,options:Omit<AiProviderConfiguration,"protocol"|"model">){super(model,{...options,model,protocol:"openai-responses"})}
  async analyse(request:AiAnalysisRequest){const value:any=await this.post(safeEndpoint(this.options.baseUrl,"/v1/responses",this.options.protocol),{model:this.model,store:false,input:[{role:"system",content:systemInstruction},{role:"user",content:JSON.stringify(request)}],text:{format:{type:"json_schema",name:"grounded_analysis",strict:true,schema:resultSchema(request.outputSchema)}}},this.options.apiKey?{Authorization:`Bearer ${this.options.apiKey}`}:{ });const text=value.output_text??value.output?.flatMap((item:any)=>item.content??[]).find((item:any)=>item.type==="output_text")?.text;if(!text)throw new Error("ai_provider_empty_response");return jsonText(text)}
}
export class OpenAiChatAnalysisProvider extends HttpAnalysisProvider{
  readonly id="openai-chat";
  async analyse(request:AiAnalysisRequest){const value:any=await this.post(safeEndpoint(this.options.baseUrl,"/v1/chat/completions",this.options.protocol),{model:this.model,messages:[{role:"system",content:systemInstruction},{role:"user",content:JSON.stringify(request)}],response_format:{type:"json_object"},stream:false},this.options.apiKey?{Authorization:`Bearer ${this.options.apiKey}`}:{ });const text=value.choices?.[0]?.message?.content;if(typeof text!=="string")throw new Error("ai_provider_empty_response");return jsonText(text)}
}
export class AnthropicMessagesAnalysisProvider extends HttpAnalysisProvider{
  readonly id="anthropic-messages";
  async analyse(request:AiAnalysisRequest){const value:any=await this.post(safeEndpoint(this.options.baseUrl,"/v1/messages",this.options.protocol),{model:this.model,max_tokens:4096,system:`${systemInstruction}\nRequired JSON schema: ${JSON.stringify(resultSchema(request.outputSchema))}`,messages:[{role:"user",content:JSON.stringify(request)}]},this.options.apiKey?{"x-api-key":this.options.apiKey,"anthropic-version":"2023-06-01"}:{"anthropic-version":"2023-06-01"});const text=value.content?.find((item:any)=>item.type==="text")?.text;if(typeof text!=="string")throw new Error("ai_provider_empty_response");return jsonText(text)}
}
export class GenericJsonAnalysisProvider extends HttpAnalysisProvider{
  readonly id="generic-json";
  async analyse(request:AiAnalysisRequest){const value:any=await this.post(safeEndpoint(this.options.baseUrl,"",this.options.protocol),{contract:"timsys.analysis-engine.v1",model:this.model,systemInstruction,request,responseSchema:resultSchema(request.outputSchema)},this.options.apiKey?{Authorization:`Bearer ${this.options.apiKey}`}:{ });return groundedAnalysisResponse.parse(value.result??value)}
}
export function createAiAnalysisProvider(configuration:AiProviderConfiguration):AiAnalysisProvider{const path=configuration.protocol==="openai-responses"?"/v1/responses":configuration.protocol==="openai-chat"?"/v1/chat/completions":configuration.protocol==="anthropic-messages"?"/v1/messages":"";safeEndpoint(configuration.baseUrl,path,configuration.protocol);if(configuration.protocol==="openai-responses")return new OpenAiResponsesAnalysisProvider(configuration.model,configuration);if(configuration.protocol==="openai-chat")return new OpenAiChatAnalysisProvider(configuration.model,configuration);if(configuration.protocol==="anthropic-messages")return new AnthropicMessagesAnalysisProvider(configuration.model,configuration);return new GenericJsonAnalysisProvider(configuration.model,configuration)}
export async function runGroundedAiAnalysis(provider:AiAnalysisProvider,request:AiAnalysisRequest){if(!request.evidence.length)throw new Error("analysis_evidence_required");const allowed=new Set(request.evidence.map(item=>item.segmentId)),response=groundedAnalysisResponse.parse(await provider.analyse(request));if(response.evidenceSegmentIds.some(id=>!allowed.has(id)))throw new Error("unsupported_analysis_citation");return response}
