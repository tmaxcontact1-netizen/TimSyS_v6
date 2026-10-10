import {describe,expect,it} from "vitest";
import {loadConfig} from "../src/infrastructure/config.js";
const base={RESEARCHED_DATABASE_URL:"postgresql://localhost/test"};
describe("AI provider configuration",()=>{
  it("keeps AI optional",()=>expect(loadConfig(base).ai).toBeNull());
  it("defaults API-key-only configuration to OpenAI Responses",()=>expect(loadConfig({...base,RESEARCHED_AI_API_KEY:"secret"}).ai).toMatchObject({protocol:"openai-responses",baseUrl:"https://api.openai.com",model:"gpt-5-mini"}));
  it("allows a keyless local OpenAI-compatible model",()=>expect(loadConfig({...base,RESEARCHED_AI_PROTOCOL:"openai-chat",RESEARCHED_AI_BASE_URL:"http://127.0.0.1:11434",RESEARCHED_AI_MODEL:"local-model"}).ai).toMatchObject({protocol:"openai-chat",model:"local-model"}));
  it("falls back for incomplete generic configuration",()=>expect(loadConfig({...base,RESEARCHED_AI_PROTOCOL:"generic-json",RESEARCHED_AI_MODEL:"model"})).toMatchObject({ai:null,aiUnavailableReason:'incomplete_ai_configuration'}));
  it.each(['magic','gemini','chatgpt-plan'])("keeps deterministic startup for unsupported %s",protocol=>expect(loadConfig({...base,RESEARCHED_AI_PROTOCOL:protocol})).toMatchObject({ai:null,aiUnavailableReason:'unsupported_ai_protocol'}));
  it('disables remote AI without credentials',()=>expect(loadConfig({...base,RESEARCHED_AI_PROTOCOL:'openai-responses'})).toMatchObject({ai:null,aiUnavailableReason:'missing_ai_credentials'}));
  it.each(['not a URL','http://remote.test','https://user:secret@example.test','https://example.test/#secret'])('does not crash or expose an invalid endpoint %s',baseUrl=>expect(loadConfig({...base,RESEARCHED_AI_PROTOCOL:'openai-responses',RESEARCHED_AI_BASE_URL:baseUrl,RESEARCHED_AI_API_KEY:'secret'})).toMatchObject({ai:null,aiUnavailableReason:'invalid_ai_endpoint'}));
  it('preserves required deterministic configuration checks',()=>{expect(()=>loadConfig({})).toThrow('DATABASE_URL');expect(()=>loadConfig({...base,RESEARCHED_PORT:'bad'})).toThrow('PORT');});
});
