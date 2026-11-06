import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {adaptConnections} from '../apps/principaled/src/documentary-landscape/connections.ts';
import {fromJd,layout} from '../apps/principaled/src/documentary-landscape/model.ts';
import {connectionFixture} from './landscape-connection-fixtures.mjs';
const require=createRequire(import.meta.url),api=require('../platform/modules/nervous_breakdown');
test('only explicit evidence-backed records enter the generic adapter; wording and identity are retained',()=>{
 const {model,statement,records}=connectionFixture(5),before=JSON.stringify(layout(model,{}));
 const result=adaptConnections(model,statement,records);
 assert.equal(result.connections.length,5);assert.equal(result.rejected.length,0);
 assert.ok(result.connections.every(r=>r.direction==='unspecified'&&r.destinationId===model.containers[1].id&&r.phrase==='works with'));
 assert.equal(JSON.stringify(layout(model,{})),before);assert.equal(model.containers.length,2);
 for(const field of ['phrase','counterpartWording','fullSourcePassage','sourceLocation','sourceDocument','fullSourceSentence']){
  const bad=structuredClone(records[0]);bad[field]='unsupported';
  assert.equal(adaptConnections(model,statement,[bad]).connections.length,0,field);
 }
 assert.equal(adaptConnections(model,statement,[records[0],records[0]]).connections.length,0);
 for(const status of ['role_mention','unresolved_connection','documentary_boundary']){
  assert.equal(adaptConnections(model,statement,[{...records[0],status}]).connections.length,0);
 }
});
test('absent, ambiguous, aliased and researcher-audit-only counterparts never create containers or inferred routes',()=>{
 const {model,statement,records}=connectionFixture(1),r=records[0];
 for(const resolution of ['no_exact_documentary_title','ambiguous_documentary_title','researcher_equivalence']){
  assert.equal(adaptConnections(model,statement,[{...r,resolution}]).connections[0].destinationId,undefined);
 }
 model.containers[1].title='A seemingly equivalent role';
 assert.equal(adaptConnections(model,statement,[r]).connections[0].destinationId,undefined);
 assert.equal(model.containers.length,2);
});
test('generic policy origins use the same evidence contract',()=>{
 const {model,statement,records}=connectionFixture(1);
 model.containers[0].source.documentType='Policy';model.containers[0].labels={container:'Policy',section:'Section',statement:'Statement'};
 assert.equal(adaptConnections(model,statement,records).connections.length,1);
});
test('different literal predicates to the same counterpart remain separate without inferred direction',()=>{
 const {model,statement,records}=connectionFixture(2),second=records[1];
 statement.text=statement.text.slice(0,second.phraseSpan.start)+'reports to'+statement.text.slice(second.phraseSpan.end);
 second.phrase='reports to';
 for(const r of records){r.fullSourceSentence=statement.text;r.fullSourcePassage=statement.text;}
 const result=adaptConnections(model,statement,records);
 assert.deepEqual(result.connections.map(r=>r.phrase),['works with','reports to']);
 assert.ok(result.connections.every(r=>r.direction==='unspecified'));
});
for(const count of [1,5,20,100])test(`selection-local adapter retains all ${count} records with 25,000 statements`,()=>{
 const {model,statement,records}=connectionFixture(count,true),start=performance.now();
 assert.equal(adaptConnections(model,statement,records).connections.length,count);
 assert.equal(adaptConnections(model,[...model.statements.values()][1],records).connections.length,0);
 console.log(JSON.stringify({count,containers:model.containers.length,statements:model.statements.size,adapterMs:performance.now()-start}));
});
test('real frozen projection: source fence, selection-local API, exact identities, all evidence and negative mentions',{skip:!process.env.NB_ACCEPTANCE_PROJECT},async()=>{
 process.env.NODE_ENV='test';
 process.env.NB_FROZEN_JD_MATRIX=path.resolve('../researched-content-analysis/apps/researched/dist/src/domain/jd-matrix.js');
 const bytes=fs.readFileSync(process.env.NB_ACCEPTANCE_PROJECT),p=JSON.parse(bytes);
 const out=fs.mkdtempSync(path.resolve('diagnostics/landscape-phase2a/source-test-'));
 process.env.NB_DOCUMENTARY_ROOT=out;fs.mkdirSync(path.join(out,p.id));fs.writeFileSync(path.join(out,p.id,'project.json'),bytes);
 const snapshot=(await api.landscape({params:{id:p.id}})).snapshot,model=fromJd(snapshot);
 const {jdMatrix}=await import('../'+ '../researched-content-analysis/apps/researched/dist/src/domain/jd-matrix.js');
 const matrix=jdMatrix(p.documents,p.review),rejected=[];let count=0;
 for(const s of model.statements.values()){
  const c=model.containers.find(c=>c.id===s.containerId);
  const response=await api.connections({params:{id:p.id,documentId:c.source.documentId,passageId:s.passageId},query:{revision:snapshot.revision}});
  assert.equal(response.success,true);
  assert.ok(response.records.every(r=>r.passageId===s.passageId));
  const adapted=adaptConnections(model,s,response.records);count+=adapted.connections.length;rejected.push(...adapted.rejected);
 }
 assert.equal(count,matrix.documentedRelationships.length);assert.deepEqual(rejected,[]);
 const mention=matrix.mentions.find(m=>!matrix.documentedRelationships.some(r=>r.passageId===m.passageId));
 assert.ok(mention);const s=[...model.statements.values()].find(s=>s.passageId===mention.passageId);
 const req={params:{id:p.id,documentId:model.containers.find(c=>c.id===s.containerId).source.documentId,passageId:s.passageId},query:{revision:snapshot.revision}};
 assert.deepEqual((await api.connections(req)).records,[]);
 assert.equal((await api.connections({...req,query:{revision:'stale'}})).success,false);
 assert.equal(fs.readFileSync(process.env.NB_ACCEPTANCE_PROJECT).equals(bytes),true);
 fs.writeFileSync('diagnostics/landscape-phase2a/adapter-audit.json',JSON.stringify({count,rejected,negativeMention:mention},null,2));
 delete process.env.NB_DOCUMENTARY_ROOT;
});
