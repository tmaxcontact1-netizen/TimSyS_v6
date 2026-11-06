import test from 'node:test';
import assert from 'node:assert/strict';
import {fromJd,layout,home,visible,reframe,closeInspector,sectionPresentation,statementLabel,SearchIndex} from '../apps/principaled/src/documentary-landscape/model.ts';
import {jdFixture,policyFixture} from './landscape-fixtures.mjs';

test('balanced geography remains identical after navigation, search, resize and reconstruction',()=>{
  for(const count of [10,50,200]){
    const fixture=jdFixture(count,count*125),model=fromJd(fixture),before=layout(model,{});
    const width=Math.max(...before.map(t=>t.x+t.width)),height=Math.max(...before.map(t=>t.y+t.height));
    assert.ok(width/height>.5&&width/height<2,'No long strip');
    new SearchIndex(model).find('destination');
    for(const bounds of [[400,400],[800,600],[1700,900]])visible(before,home().camera,...bounds);
    assert.strictEqual(layout(model,{}),before);
    assert.deepEqual(layout(fromJd(structuredClone(fixture)),{}),before);
  }
});
test('sections with 5, 20 and 125 statements have stable balanced addresses and bounded culling',()=>{
  for(const count of [5,20,125]){
    const fixture=jdFixture(1,count);fixture.documents[0].passages.forEach(p=>p.dimension='Single original section');
    const model=fromJd(fixture),context={containerId:model.containers[0].id,sectionId:model.containers[0].sectionIds[0]},tiles=layout(model,context);
    assert.equal(tiles.length,count);
    const width=Math.max(...tiles.map(t=>t.x+t.width)),height=Math.max(...tiles.map(t=>t.y+t.height));
    assert.ok(width/height>.5&&width/height<2);
    assert.ok(visible(tiles,home().camera,950,550).length<=20);
    assert.deepEqual(layout(fromJd(structuredClone(fixture)),context),tiles);
  }
});
test('description labels are presentation-only and preserve genuine uncertainty',()=>{
  const fixture=jdFixture(1,1),p=fixture.documents[0].passages[0];p.kind='descriptor';p.dimension='Unassigned — check source';
  const before=JSON.stringify(fixture),model=fromJd(fixture),section=[...model.sections.values()][0],s=[...model.statements.values()][0],c=model.containers[0];
  assert.equal(sectionPresentation(model,section).title,'Role description');
  assert.equal(statementLabel(c,s,section),'Role description');
  assert.equal(section.title,p.dimension);assert.equal(s.text,p.text);assert.equal(JSON.stringify(fixture),before);
  p.ambiguity='Source structure not established';
  const uncertain=fromJd(fixture),u=[...uncertain.sections.values()][0];
  assert.equal(sectionPresentation(uncertain,u).title,'Unresolved source structure');
  assert.equal(statementLabel(uncertain.containers[0],[...uncertain.statements.values()][0],u),'Unresolved source structure');
  delete p.ambiguity;p.kind='statement';
  const unknown=fromJd(fixture);assert.equal(sectionPresentation(unknown,[...unknown.sections.values()][0]).title,'Unresolved source structure');
});
test('policy presentation remains generic and does not invent a source section',()=>{
  const model=policyFixture(),section=[...model.sections.values()][0],container=model.containers[0];
  assert.equal(statementLabel(container,[...model.statements.values()][0],section),'Policy statement');
  section.title='Unassigned — check source';section.statementIds.forEach(id=>model.statements.get(id).kind='descriptor');
  assert.equal(sectionPresentation(model,section).title,'Policy description');
  assert.equal(section.title,'Unassigned — check source');
  container.source.documentType='Other document';assert.equal(sectionPresentation(model,section).title,'Source description');
});
test('dock translation keeps the selected object visible; close restores exact pre-dock camera and context',()=>{
  const tile={id:'last',x:900,y:340,width:254,height:132},camera={x:32,y:32,zoom:1.4};
  const docked=reframe(tile,camera,640,550);
  assert.ok(tile.x*docked.zoom+docked.x>=24);
  assert.ok((tile.x+tile.width)*docked.zoom+docked.x<=616);
  assert.ok((tile.y+tile.height)*docked.zoom+docked.y<=526);
  const frame={context:{containerId:'role',sectionId:'section',statementId:'last'},camera:docked,undockedCamera:camera,selection:'last',inspectorOpen:true};
  const closed=closeInspector(frame);
  assert.deepEqual(closed.camera,camera);assert.deepEqual(closed.context,frame.context);assert.equal(closed.selection,'last');assert.equal(closed.inspectorOpen,false);
  assert.deepEqual(reframe(tile,docked,640,550),docked,'Reframe is idempotent');
});
