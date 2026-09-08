import { resolve } from "node:path";
import type { AiProtocol } from "../application/ai-analysis.js";
export function loadConfig(env:NodeJS.ProcessEnv){
  const databaseUrl=env.RESEARCHED_DATABASE_URL;
  if(!databaseUrl) throw new Error("RESEARCHED_DATABASE_URL is required");
  const port=Number(env.RESEARCHED_PORT??8092);
  if(!Number.isSafeInteger(port)||port<1||port>65535) throw new Error("RESEARCHED_PORT is invalid");
  const rawProtocol=env.RESEARCHED_AI_PROTOCOL?.trim()||(env.RESEARCHED_AI_API_KEY?"openai-responses":""),protocols=new Set(["openai-responses","openai-chat","anthropic-messages","generic-json"]);
  if(rawProtocol&&!protocols.has(rawProtocol)) throw new Error("RESEARCHED_AI_PROTOCOL is invalid");
  const defaults:Record<string,string>={"openai-responses":"https://api.openai.com","openai-chat":"https://api.openai.com","anthropic-messages":"https://api.anthropic.com"};
  const baseUrl:string=env.RESEARCHED_AI_BASE_URL?.trim()||(rawProtocol?(defaults[rawProtocol]??""):"");
  const model=env.RESEARCHED_AI_MODEL?.trim()||(rawProtocol==="openai-responses"||rawProtocol==="openai-chat"?"gpt-5-mini":"");
  if(rawProtocol&&(!baseUrl||!model)) throw new Error("AI base URL and model are required");
  const apiKey=env.RESEARCHED_AI_API_KEY?.trim();
  return {databaseUrl,port,storageRoot:resolve(env.RESEARCHED_STORAGE_ROOT??"storage"),appRoot:resolve(env.RESEARCHED_APP_ROOT??process.cwd()),ai:rawProtocol?{protocol:rawProtocol as AiProtocol,...(apiKey?{apiKey}:{}),baseUrl,model}:null};
}
