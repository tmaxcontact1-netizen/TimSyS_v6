import {z} from "zod";
import type {AnalysisTypeId} from "./analysis.js";

const text=z.string().trim().min(1),texts=z.array(text).default([]),nonNegative=z.number().min(0);
const schemas:Record<AnalysisTypeId,z.ZodType>= {
  syntax:z.object({wordCount:nonNegative.int(),sentenceCount:nonNegative.int(),paragraphCount:nonNegative.int(),averageSentenceWords:nonNegative}).strict(),
  readability:z.object({fleschReadingEase:z.number().min(0).max(100),estimatedMinutes:nonNegative}).strict(),
  terminology:z.object({summary:text,terms:z.array(z.object({term:text,meaning:text,importance:text}).strict()).default([])}).strict(),
  entities:z.object({entities:z.array(z.object({name:text,type:z.enum(["person","organisation","place","date","event","work","other"]),context:text}).strict()).default([])}).strict(),
  semantics:z.object({summary:text,intents:texts,keyMessages:texts}).strict(),
  sentiment:z.object({overall:z.enum(["positive","negative","neutral","mixed"]),rationale:text,signals:z.array(z.object({label:text,polarity:z.enum(["positive","negative","neutral"])}).strict()).default([])}).strict(),
  themes:z.object({themes:z.array(z.object({name:text,description:text,sourceIds:z.array(z.string().uuid()).min(2)}).strict()).default([])}).strict(),
  claims:z.object({claims:z.array(z.object({claim:text,support:z.enum(["supported","partially-supported","unsupported","unclear"]),qualification:z.string()}).strict()).default([])}).strict(),
  comparison:z.object({comparisons:z.array(z.object({topic:text,observations:z.array(z.object({sourceId:z.string().uuid(),summary:text}).strict()).min(2),interpretation:text}).strict()).default([])}).strict(),
  contradictions:z.object({contradictions:z.array(z.object({sourceAId:z.string().uuid(),statementA:text,sourceBId:z.string().uuid(),statementB:text,explanation:text}).strict()).default([])}).strict(),
  "bias-framing":z.object({frames:texts,indicators:texts,cautions:texts}).strict(),
  completeness:z.object({fields:z.array(z.object({field:text,found:z.boolean(),evidence:z.string().optional()}).strict()).default([]),missing:texts}).strict(),
  "custom-extraction":z.object({fields:z.record(z.string(),z.unknown())}).strict(),
  "custom-questions":z.object({answers:z.array(z.object({question:text,answer:text}).strict()).default([])}).strict(),
};

export const ANALYSIS_RESULT_CONTRACT_VERSION="researched.analysis-result.v1";
export const analysisResultJsonSchemas:Record<AnalysisTypeId,Record<string,unknown>>={
  syntax:{type:"object",additionalProperties:false,required:["wordCount","sentenceCount","paragraphCount","averageSentenceWords"],properties:{wordCount:{type:"integer",minimum:0},sentenceCount:{type:"integer",minimum:0},paragraphCount:{type:"integer",minimum:0},averageSentenceWords:{type:"number",minimum:0}}},
  readability:{type:"object",additionalProperties:false,required:["fleschReadingEase","estimatedMinutes"],properties:{fleschReadingEase:{type:"number",minimum:0,maximum:100},estimatedMinutes:{type:"number",minimum:0}}},
  terminology:{type:"object",additionalProperties:false,required:["summary","terms"],properties:{summary:{type:"string",minLength:1},terms:{type:"array",items:{type:"object",additionalProperties:false,required:["term","meaning","importance"],properties:{term:{type:"string"},meaning:{type:"string"},importance:{type:"string"}}}}}},
  entities:{type:"object",additionalProperties:false,required:["entities"],properties:{entities:{type:"array",items:{type:"object",additionalProperties:false,required:["name","type","context"],properties:{name:{type:"string"},type:{enum:["person","organisation","place","date","event","work","other"]},context:{type:"string"}}}}}},
  semantics:{type:"object",additionalProperties:false,required:["summary","intents","keyMessages"],properties:{summary:{type:"string"},intents:{type:"array",items:{type:"string"}},keyMessages:{type:"array",items:{type:"string"}}}},
  sentiment:{type:"object",additionalProperties:false,required:["overall","rationale","signals"],properties:{overall:{enum:["positive","negative","neutral","mixed"]},rationale:{type:"string"},signals:{type:"array",items:{type:"object",additionalProperties:false,required:["label","polarity"],properties:{label:{type:"string"},polarity:{enum:["positive","negative","neutral"]}}}}}},
  themes:{type:"object",additionalProperties:false,required:["themes"],properties:{themes:{type:"array",items:{type:"object",additionalProperties:false,required:["name","description","sourceIds"],properties:{name:{type:"string"},description:{type:"string"},sourceIds:{type:"array",minItems:2,items:{type:"string"}}}}}}},
  claims:{type:"object",additionalProperties:false,required:["claims"],properties:{claims:{type:"array",items:{type:"object",additionalProperties:false,required:["claim","support","qualification"],properties:{claim:{type:"string"},support:{enum:["supported","partially-supported","unsupported","unclear"]},qualification:{type:"string"}}}}}},
  comparison:{type:"object",additionalProperties:false,required:["comparisons"],properties:{comparisons:{type:"array",items:{type:"object",additionalProperties:false,required:["topic","observations","interpretation"],properties:{topic:{type:"string"},observations:{type:"array",minItems:2,items:{type:"object",additionalProperties:false,required:["sourceId","summary"],properties:{sourceId:{type:"string"},summary:{type:"string"}}}},interpretation:{type:"string"}}}}}},
  contradictions:{type:"object",additionalProperties:false,required:["contradictions"],properties:{contradictions:{type:"array",items:{type:"object",additionalProperties:false,required:["sourceAId","statementA","sourceBId","statementB","explanation"],properties:{sourceAId:{type:"string"},statementA:{type:"string"},sourceBId:{type:"string"},statementB:{type:"string"},explanation:{type:"string"}}}}}},
  "bias-framing":{type:"object",additionalProperties:false,required:["frames","indicators","cautions"],properties:{frames:{type:"array",items:{type:"string"}},indicators:{type:"array",items:{type:"string"}},cautions:{type:"array",items:{type:"string"}}}},
  completeness:{type:"object",additionalProperties:false,required:["fields","missing"],properties:{fields:{type:"array",items:{type:"object",additionalProperties:false,required:["field","found"],properties:{field:{type:"string"},found:{type:"boolean"},evidence:{type:"string"}}}},missing:{type:"array",items:{type:"string"}}}},
  "custom-extraction":{type:"object",additionalProperties:false,required:["fields"],properties:{fields:{type:"object",additionalProperties:true}}},
  "custom-questions":{type:"object",additionalProperties:false,required:["answers"],properties:{answers:{type:"array",items:{type:"object",additionalProperties:false,required:["question","answer"],properties:{question:{type:"string"},answer:{type:"string"}}}}}},
};

export function parseAnalysisValue(type:AnalysisTypeId,value:unknown){return schemas[type].parse(value)}
export function validateAnalysisSourceRelationships(type:AnalysisTypeId,value:unknown,allowedSourceIds:readonly string[]){
  const parsed=parseAnalysisValue(type,value) as any,allowed=new Set(allowedSourceIds);let references:string[]=[];
  if(type==="themes")references=parsed.themes.flatMap((theme:any)=>theme.sourceIds);
  if(type==="comparison")references=parsed.comparisons.flatMap((comparison:any)=>comparison.observations.map((item:any)=>item.sourceId));
  if(type==="contradictions")references=parsed.contradictions.flatMap((item:any)=>[item.sourceAId,item.sourceBId]);
  if(references.some(id=>!allowed.has(id)))throw new Error("unsupported_analysis_source_relationship");
  if(type==="comparison"&&parsed.comparisons.some((item:any)=>new Set(item.observations.map((observation:any)=>observation.sourceId)).size<2))throw new Error("comparison_requires_distinct_sources");
  if(type==="contradictions"&&parsed.contradictions.some((item:any)=>item.sourceAId===item.sourceBId))throw new Error("contradiction_requires_distinct_sources");
  return parsed;
}
export function jsonSchemaForAnalysis(type:AnalysisTypeId,expectedFields:readonly string[]=[]){
  if(type!=="custom-extraction")return analysisResultJsonSchemas[type];
  const properties=Object.fromEntries(expectedFields.map(field=>[field,{type:["string","number","boolean","array","null"],items:{type:"string"}}]));
  return{type:"object",additionalProperties:false,required:["fields"],properties:{fields:{type:"object",additionalProperties:false,required:[...expectedFields],properties}}};
}
export function parseStoredAnalysisResult(type:AnalysisTypeId,method:"rules"|"ai"|"hybrid",value:unknown){
  if(method==="rules")return parseAnalysisValue(type,value);
  return z.object({interpretation:schemas[type],limitations:z.array(z.string()),...(method==="hybrid"?{deterministic:z.unknown()}:{})}).strict().parse(value);
}
