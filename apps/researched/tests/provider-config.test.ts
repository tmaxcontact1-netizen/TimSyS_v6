import {describe,expect,it} from "vitest";
import {loadConfig} from "../src/infrastructure/config.js";
const base={RESEARCHED_DATABASE_URL:"postgresql://localhost/test"};
describe("AI provider configuration",()=>{
  it("keeps AI optional",()=>expect(loadConfig(base).ai).toBeNull());
  it("defaults API-key-only configuration to OpenAI Responses",()=>expect(loadConfig({...base,RESEARCHED_AI_API_KEY:"secret"}).ai).toMatchObject({protocol:"openai-responses",baseUrl:"https://api.openai.com",model:"gpt-5-mini"}));
  it("allows a keyless local OpenAI-compatible model",()=>expect(loadConfig({...base,RESEARCHED_AI_PROTOCOL:"openai-chat",RESEARCHED_AI_BASE_URL:"http://127.0.0.1:11434",RESEARCHED_AI_MODEL:"local-model"}).ai).toMatchObject({protocol:"openai-chat",model:"local-model"}));
  it("requires explicit connection details for generic providers",()=>expect(()=>loadConfig({...base,RESEARCHED_AI_PROTOCOL:"generic-json",RESEARCHED_AI_MODEL:"model"})).toThrow("AI base URL and model are required"));
  it("rejects unknown protocols",()=>expect(()=>loadConfig({...base,RESEARCHED_AI_PROTOCOL:"magic"})).toThrow("RESEARCHED_AI_PROTOCOL is invalid"));
});
