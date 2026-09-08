import {describe,expect,it} from "vitest";
import {OpenAiResponsesAnalysisProvider,createAiAnalysisProvider,inspectAiConnection,runGroundedAiAnalysis} from "../src/application/ai-analysis.js";
const segment="9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046",source="22cd85b5-a1df-447f-8a5e-40916c367c27";
describe("AI analysis boundary",()=>{
  it("accepts structured results citing supplied evidence",async()=>{
    const result=await runGroundedAiAnalysis({id:"test",model:"test",analyse:async()=>({value:{theme:"access"},confidence:.8,evidenceSegmentIds:[segment],limitations:[]})},{requestId:source,analysisType:"themes",instructions:"Identify themes",evidence:[{segmentId:segment,sourceId:source,content:"Access is required."}]});
    expect(result.confidence).toBe(.8);
  });
  it("rejects invented citations",async()=>{
    await expect(runGroundedAiAnalysis({id:"test",model:"test",analyse:async()=>({value:{},confidence:.5,evidenceSegmentIds:[source],limitations:[]})},{requestId:source,analysisType:"themes",instructions:"Identify themes",evidence:[{segmentId:segment,sourceId:source,content:"Evidence"}]})).rejects.toThrow("unsupported_analysis_citation");
  });
  it("calls the Responses API without persistence and validates JSON output",async()=>{
    let captured:any;
    const provider=new OpenAiResponsesAnalysisProvider("test-model",{apiKey:"test-secret",baseUrl:"https://api.example.test",fetch:async(url,init)=>{captured={url:String(url),init}; return new Response(JSON.stringify({output_text:JSON.stringify({value:{tone:"neutral"},confidence:.75,evidenceSegmentIds:[segment],limitations:[]})}),{status:200,headers:{"content-type":"application/json"}});}});
    const result=await runGroundedAiAnalysis(provider,{requestId:source,analysisType:"sentiment",instructions:"Assess tone",evidence:[{segmentId:segment,sourceId:source,content:"Evidence"}]});
    expect(result.value).toEqual({tone:"neutral"});
    expect(captured.url).toBe("https://api.example.test/v1/responses");
    expect(JSON.parse(captured.init.body).store).toBe(false);
    expect(captured.init.headers.Authorization).toBe("Bearer test-secret");
  });
  it("passes an analysis-specific value schema to strict-output providers",async()=>{
    let schema:any;
    const provider=new OpenAiResponsesAnalysisProvider("test-model",{baseUrl:"https://api.example.test",fetch:async(_url,init)=>{schema=JSON.parse(String(init?.body)).text.format.schema;return new Response(JSON.stringify({output_text:JSON.stringify({value:{summary:"Meaning",intents:[],keyMessages:[]},confidence:.8,evidenceSegmentIds:[segment],limitations:[]})}),{status:200});}});
    await provider.analyse({requestId:source,analysisType:"semantics",instructions:"Analyse",evidence:[{segmentId:segment,sourceId:source,content:"Evidence"}],outputSchema:{type:"object",required:["summary"],properties:{summary:{type:"string"}}}});
    expect(schema.properties.value.required).toEqual(["summary"]);
  });
  it.each([
    ["openai-chat","http://127.0.0.1:11434","/v1/chat/completions",{choices:[{message:{content:JSON.stringify({value:{answer:"yes"},confidence:.7,evidenceSegmentIds:[segment],limitations:[]})}}]}],
    ["anthropic-messages","https://api.anthropic.test","/v1/messages",{content:[{type:"text",text:JSON.stringify({value:{answer:"yes"},confidence:.7,evidenceSegmentIds:[segment],limitations:[]})}]}],
    ["generic-json","https://model.example.test/analyse","/analyse",{result:{value:{answer:"yes"},confidence:.7,evidenceSegmentIds:[segment],limitations:[]}}],
  ] as const)("supports the %s provider protocol",async(protocol,baseUrl,path,responseBody)=>{
    let target=""; const provider=createAiAnalysisProvider({protocol,model:"model",baseUrl,fetch:async(url)=>{target=String(url);return new Response(JSON.stringify(responseBody),{status:200})}});
    const result=await runGroundedAiAnalysis(provider,{requestId:source,analysisType:"semantics",instructions:"Analyse",evidence:[{segmentId:segment,sourceId:source,content:"Evidence"}]});
    expect(new URL(target).pathname).toBe(path); expect(result.value).toEqual({answer:"yes"});
  });
  it("rejects insecure remote provider endpoints",async()=>{
    expect(()=>createAiAnalysisProvider({protocol:"generic-json",model:"model",baseUrl:"http://remote.example.test/analyse",fetch:async()=>new Response()})).toThrow("ai_provider_requires_https_or_loopback");
  });
  it("discovers models and reports connection latency without exposing credentials",async()=>{
    let authorization="";
    const result=await inspectAiConnection({protocol:"openai-chat",model:"chosen",baseUrl:"https://models.example.test",apiKey:"secret",fetch:async(_url,init)=>{authorization=String((init?.headers as Record<string,string>).Authorization);return new Response(JSON.stringify({data:[{id:"z-model"},{id:"a-model"}]}),{status:200});}});
    expect(result).toMatchObject({status:"available",models:["a-model","z-model"]});
    expect(authorization).toBe("Bearer secret");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("makes custom webhooks explicitly analysis-time validated",async()=>{
    expect(await inspectAiConnection({protocol:"generic-json",model:"custom",baseUrl:"https://models.example.test/analyse"})).toMatchObject({status:"unsupported",models:[]});
  });
});
