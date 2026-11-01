import {describe,it,expect} from 'vitest';
import {createAiAnalysisProvider} from '../src/application/ai-analysis.js';
import {providerIdentity,checkResumeProvider} from '../src/application/provider-identity.js';
import {loadConfig} from '../src/infrastructure/config.js';
import {SemanticWorker} from '../src/application/mcf-semantic.js';
const provider=(port=12345,profile='original',model='model')=>createAiAnalysisProvider({protocol:'openai-responses',baseUrl:'http://127.0.0.1:'+port,model,managedProfileId:profile});
describe('stable managed provider identity',()=>{
 it('survives bridge port changes but rejects different profiles/models',()=>{
  const a=providerIdentity(provider())!;expect(providerIdentity(provider(23456))).toEqual(a);
  expect(()=>checkResumeProvider(a,providerIdentity(provider(23456))!)).not.toThrow();
  for(const p of [provider(23456,'other'),provider(23456,'original','other')])expect(()=>checkResumeProvider(a,providerIdentity(p)!,true)).toThrow('Reconnect');
 });
 it('keeps endpoint fingerprints for unmanaged or remote providers',()=>{
  for(const managedProfileId of [undefined,'profile']){
   const a=createAiAnalysisProvider({protocol:'openai-responses',baseUrl:'https://one.example',model:'model',...(managedProfileId?{managedProfileId}:{})});
   const b=createAiAnalysisProvider({protocol:'openai-responses',baseUrl:'https://two.example',model:'model',...(managedProfileId?{managedProfileId}:{})});
   expect(a.identityVersion).toBe(1);expect(a.configurationId).not.toBe(b.configurationId);
  }
  expect(createAiAnalysisProvider({protocol:'openai-responses',baseUrl:'http://127.0.0.1:1234',model:'model'}).identityVersion).toBe(1);
 });
 it('requires explicit legacy confirmation without allowing model/protocol changes',()=>{
  const current=providerIdentity(provider())!,old={id:current.id,model:current.model,connectionId:'old-port-hash'};
  expect(()=>checkResumeProvider(old,current)).toThrow('legacy_provider_confirmation_required');
  expect(()=>checkResumeProvider(old,current,true)).not.toThrow();
  for(const change of [{id:'openai-chat'},{model:'other'}])expect(()=>checkResumeProvider({...old,...change},current,true)).toThrow('Reconnect');
 });
 it('accepts profile identity only in managed startup configuration',()=>{
  const env={RESEARCHED_DATABASE_URL:'test',RESEARCHED_AI_PROTOCOL:'openai-responses',RESEARCHED_AI_BASE_URL:'http://127.0.0.1:1234',RESEARCHED_AI_MODEL:'model',RESEARCHED_AI_PROFILE_ID:'profile'};
  expect(loadConfig(env).ai?.managedProfileId).toBeUndefined();
  expect(loadConfig({...env,RESEARCHED_AI_MANAGED:'1'}).ai?.managedProfileId).toBe('profile');
 });
 it('audits legacy rebinding and queues only unfinished tasks',async()=>{
  const calls:any[]=[],audits:any[]=[];const original={id:'openai-responses',model:'model',connectionId:'legacy'};
  const run={status:'partial',configuration:{semanticProtocol:3,provider:original,semanticPolicy:{version:8}}};
  const c={query:async(sql:string,args:any[])=>{calls.push({sql,args});return sql.startsWith('SELECT * FROM researched.mcf_ai_runs')?{rows:[run]}:{rows:[],rowCount:0};}};
  const repo:any={workspace:async()=>({records:[]}),transaction:async(fn:any)=>fn(c),session:async()=>({dataset_id:'dataset'}),writable:async()=>{},active:async()=>{},audit:async(...args:any[])=>audits.push(args)};
  const worker=new SemanticWorker(repo,()=>provider());
  await expect(worker.resume('session','run','researcher')).rejects.toThrow('legacy_provider_confirmation_required');
  expect(calls.some(c=>c.sql.startsWith('UPDATE'))).toBe(false);calls.length=0;
  await worker.resume('session','run','researcher',true);
  const updates=calls.filter(c=>c.sql.startsWith('UPDATE researched.mcf_ai_tasks')||c.sql.startsWith('UPDATE researched.mcf_semantic_tasks'));
  expect(updates).toHaveLength(2);expect(updates.every(c=>c.sql.includes("status<>'completed'"))).toBe(true);
  expect(calls.some(c=>/UPDATE researched.mcf_ai_(outputs|proposals)/.test(c.sql))).toBe(false);
  expect(audits[0].at(-1)).toMatchObject({previousProvider:original,legacyProviderConfirmed:true,successfulResultsPreserved:true});
  const configurationUpdate=calls.find(c=>c.sql.startsWith('UPDATE researched.mcf_ai_runs SET'));
  expect(JSON.parse(configurationUpdate.args[2]).version).toBe(8);
  expect(configurationUpdate.sql).not.toContain('classificationConfig');
 });
});
