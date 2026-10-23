const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({page,app,model,project,root})=>{
 const out=path.join(root,'diagnostics/landscape-phase2a');fs.mkdirSync(out,{recursive:true});
 const {layout}=await import('../apps/principaled/src/documentary-landscape/model.ts');
 const inspector=app.getByRole('complementary',{name:'Source inspector'}),portals=app.getByRole('region',{name:'Documentary destinations'});
 const list=inspector.getByRole('region',{name:'Documented connections'}),evidence=inspector.getByRole('region',{name:'Connection evidence'});
 const home=()=>app.getByRole('button',{name:'Home',exact:true}).click(),back=()=>app.getByRole('button',{name:'← Back',exact:true}).click();
 const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
 async function search(query,wording){
  await app.getByRole('searchbox',{name:'Search the documents'}).fill(query);
  await app.getByRole('region',{name:'Search results'}).getByRole('button').filter({hasText:wording||query}).first().click();
  await app.getByRole('button',{name:'Clear search'}).click();
  await inspector.locator('.dl-selected-wording').waitFor();
 }
 await page.setViewportSize({width:1720,height:1700});await home();
 const s=[...model.statements.values()].find(s=>s.text.includes('in collaboration with Learning Support, AEA Coordinator, and the AEA Department.'));
 const c=model.containers.find(c=>c.id===s.containerId),section=model.sections.get(s.sectionId);
 await app.locator('.dl-tile').getByText(c.title,{exact:true}).dblclick();
 await app.locator('.dl-tile').getByText(section.title,{exact:true}).dblclick();
 // Pan within this original dimension if culling places the retained statement below the viewport.
 const tile=layout(model,{sectionId:s.sectionId}).find(t=>t.id===s.id);
 if(tile.y>400){await app.locator('.dl-viewport').focus();for(let i=0;i<Math.ceil((tile.y-200)/80);i++)await app.locator('.dl-viewport').press('ArrowDown');}
 await app.getByRole('button',{name:s.text,exact:true}).click();
 await inspector.getByRole('button',{name:'Show connections',exact:true}).waitFor();
 assert.equal(await portals.count(),0);await shot('01-teacher-before');
 const originAddress=await app.locator('.dl-selected').getAttribute('data-address');
 await inspector.getByRole('button',{name:'Show connections',exact:true}).click();
 assert.equal(await list.locator('li').count(),3);assert.equal(await portals.getByRole('button').count(),3);
 for(const name of ['Learning Support','AEA Coordinator','the AEA Department'])assert.ok((await list.innerText()).includes(name));
 assert.equal(await app.locator('.dl-selected').getAttribute('data-address'),originAddress);
 await shot('02-teacher-connections');await portals.screenshot({path:path.join(out,'03-existing-destination.png')});
 const pageScroll=await page.evaluate(()=>document.scrollingElement.scrollTop);
 await portals.getByRole('button',{name:/Learning Support/}).click();
 assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),pageScroll);
 assert.match(await evidence.innerText(),/No corresponding documentary source is currently present/);
 assert.equal(await evidence.locator('blockquote').first().innerText(),s.text);
 await shot('05-referenced-counterpart');await shot('06-evidence-inspector');
 const originCamera=await app.locator('.dl-world').getAttribute('style');
 const destination=model.containers.find(c=>c.title==='AEA Coordinator'),destinationTile=layout(model,{}).find(t=>t.id===destination.id);
 await portals.getByRole('button',{name:/AEA Coordinator/}).click();
 assert.equal(await app.locator('.dl-selected').getAttribute('data-object-id'),destination.id);
 assert.equal(await app.locator('.dl-selected').getAttribute('data-address'),`${destinationTile.x},${destinationTile.y}`);
 assert.equal(await app.locator(`[data-object-id="${destination.id}"]`).count(),1);
 assert.equal(await inspector.getByRole('button',{name:'Show connections',exact:true}).count(),0);
 assert.match(await app.getByRole('complementary',{name:'Arrived via'}).innerText(),/Teacher[\s\S]*in collaboration with[\s\S]*AEA Coordinator/);
 assert.equal(await portals.count(),0);await shot('04-arrival');
 await back();
 assert.equal(await app.locator('.dl-selected').getAttribute('data-object-id'),s.id);
 assert.equal(await app.locator('.dl-world').getAttribute('style'),originCamera);
 assert.equal(await list.locator('li').count(),3);assert.equal(await evidence.count(),1);
 await inspector.getByRole('button',{name:'Hide connections',exact:true}).click();assert.equal(await portals.count(),0);assert.equal(await list.count(),0);
 await search('escalate significant behavioral concerns','Respond to student behavior');
 await inspector.getByRole('button',{name:'Show connections',exact:true}).click();
 assert.equal(await list.locator('li').count(),3);
 assert.equal(await list.getByRole('button',{name:'Go to the Section Principal',exact:true}).count(),1);
 assert.equal(await list.getByRole('button',{name:'Go to Subject Leader',exact:true}).count(),1);
 assert.equal(await list.getByRole('button',{name:/Go to Section Vice Principal/}).count(),0);
 await shot('07-behavioural-escalation');
 await search('Where concerns exceed the scope of school counseling','Where concerns exceed');
 await inspector.getByRole('button',{name:'Show connections',exact:true}).click();
 await list.locator('.dl-connection-inspect').filter({hasText:'AEA Coordinator'}).click();
 assert.match(await evidence.innerText(),/refers the case to/);assert.match(await evidence.innerText(),/the case/);
 assert.match(await evidence.innerText(),/Where concerns exceed the scope of school counseling/);
 await evidence.getByRole('button',{name:'View Source',exact:true}).click();
 await inspector.locator('mark').waitFor();
 assert.equal(await inspector.locator('mark').innerText(),await inspector.locator('.dl-selected-wording').innerText());
 await back();await list.getByRole('button',{name:'Go to AEA Coordinator',exact:true}).click();
 assert.equal(await app.locator('.dl-selected').getAttribute('data-object-id'),destination.id);
 await home();assert.equal(await portals.count(),0);assert.equal(await app.getByRole('complementary',{name:'Arrived via'}).count(),0);
 await search('Subject Leader-facilitated department meetings','Participate actively and constructively');
 await inspector.getByText('No documented connections in this statement.',{exact:true}).waitFor();
 assert.equal(await inspector.getByRole('button',{name:'Show connections',exact:true}).count(),0);
 assert.equal(await portals.count(),0);await shot('08-no-relationship');
 // Search remains literal retrieval; the same selected statement is the only origin.
 await search('assessment accommodations','assessment accommodations');
 await inspector.locator('.dl-connection-control').waitFor();
 await home();
 fs.writeFileSync(path.join(out,'browser-real.json'),JSON.stringify({passed:true,teacherCounterparts:3,escalationCounterparts:3,counselorEvidence:true,
   existingDestination:destination.id,originAddress,backRestoresCamera:true,backRestoresInspectorAndConnections:true,noDuplicateContainer:true,
   roleMentionNegative:true,homeClearsRelationships:true},null,2));
};
