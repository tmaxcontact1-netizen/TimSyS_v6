import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fromJd,SearchIndex,layout,visible,detailLevel,ancestors,home} from '../apps/principaled/src/documentary-landscape/model.ts';
import {jdFixture,policyFixture} from './landscape-fixtures.mjs';

test('adapter retains identity, exact words, researcher exclusions and structure without mutation',()=>{
  const input=jdFixture(2,12),before=JSON.stringify(input),model=fromJd(input);
  assert.equal(JSON.stringify(input),before);assert.equal(model.statements.size,12);
  for(const d of input.documents) for(const p of d.passages) {
    const s=[...model.statements.values()].find(s=>s.passageId===p.id);
    assert.equal(s.text,d.extracted.slice(p.start,p.end));assert.equal(s.location,p.location);
  }
  const p=input.documents[0].passages[0];input.review.excluded=[p.id];
  input.review.structure={[input.documents[0].passages[1].id]:{kind:'statement',dimension:'Researcher retained dimension'}};
  const reviewed=fromJd(input);
  assert.equal(reviewed.statements.size,11);
  assert.ok([...reviewed.sections.values()].some(s=>s.title==='Researcher retained dimension'));
  assert.equal([...reviewed.statements.values()][0].originalSection,'Original section 1');
});
test('identical section names in distinct documents and repeated headings stay distinct',()=>{
  const fixture=jdFixture(2,6),d=fixture.documents[0];
  d.passages.splice(1,0,{id:'heading-a',kind:'heading',text:'Original section 1',dimension:'Original section 1',location:'synthetic'});
  const model=fromJd(fixture);
  assert.equal(model.sections.size,3);assert.equal(model.containers[0].sectionIds.length,2);
});
test('indexed literal search preserves location and handles substrings and case',()=>{
  const model=fromJd(jdFixture(3,30)),index=new SearchIndex(model);
  const found=index.find('SCALE SEARCH DESTINATION');
  assert.equal(found.length,1);assert.equal(index.find('destination.')[0].id,found[0].id);
  assert.equal(index.find('no such phrase').length,0);assert.equal(index.find('').length,0);
});
test('layout cache, LOD, culling and navigation ancestry are deterministic',()=>{
  const model=fromJd(jdFixture(200,25000)),camera=home().camera,tiles=layout(model,{});
  assert.strictEqual(layout(model,{}),tiles);
  assert.deepEqual(layout(fromJd(jdFixture(200,25000)),{}),tiles);
  assert.ok(visible(tiles,camera,1200,550).length<=12);
  assert.equal(detailLevel(1),'overview');assert.equal(detailLevel(1.3),'preview');
  const s=[...model.statements.values()][24999],chain=ancestors({containerId:s.containerId,sectionId:s.sectionId,statementId:s.id,source:true});
  assert.equal(chain.length,4);assert.deepEqual(chain[0],{});assert.equal(chain[2].sectionId,s.sectionId);
});
test('generic policy uses sections/statements and never role/dimension terminology',()=>{
  const model=policyFixture();assert.equal(model.sections.size,3);assert.equal(model.statements.size,20);
  assert.deepEqual(model.containers[0].labels,{container:'Policy',section:'Section',statement:'Statement'});
  assert.equal(new SearchIndex(model).find('policy statement 3.6').length,1);assert.equal(layout(model,{}).length,1);
});
test('current, medium and large synthetic navigation/search measurements',()=>{
  const results=[];
  for(const [roles,count] of [[10,300],[50,5000],[200,25000]]) {
    const start=performance.now(),model=fromJd(jdFixture(roles,count)),adapted=performance.now();
    const index=new SearchIndex(model),indexed=performance.now(),found=index.find('Scale search destination'),searched=performance.now();
    assert.equal(found.length,1);assert.equal(model.statements.size,count);
    const s=found[0],tiles=layout(model,{containerId:s.containerId,sectionId:s.sectionId});
    assert.ok(tiles.some(t=>t.id===s.id));
    results.push({roles,statements:count,adapterMs:adapted-start,indexMs:indexed-adapted,searchMs:searched-indexed,initialDomTiles:visible(layout(model,{}),home().camera,1200,550).length});
  }
  fs.mkdirSync(new URL('../diagnostics/landscape-phase1/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('../diagnostics/landscape-phase1/scale.json',import.meta.url),JSON.stringify(results,null,2));
  console.log(results);
});
