const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({page,app,model,project,root}){
  const out=path.join(root,'diagnostics/landscape-ux');fs.mkdirSync(out,{recursive:true});
  const {layout}=await import('../apps/principaled/src/documentary-landscape/model.ts');
  const tiles=app.locator('.dl-tile'),trail=app.getByRole('navigation',{name:'Documentary location'}),inspector=app.getByRole('complementary',{name:'Source inspector'});
  const addresses=()=>tiles.evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.objectId,n.dataset.address])));
  const camera=()=>app.locator('.dl-world').getAttribute('style');
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const screenshot=name=>app.screenshot({path:path.join(out,name+'.png')});
  async function visibleSelection(){
    await page.waitForFunction(()=>{
      const selected=document.querySelector('.dl-selected'),vp=document.querySelector('.dl-viewport');
      if(!selected||!vp)return false;const s=selected.getBoundingClientRect(),v=vp.getBoundingClientRect();
      return s.left>=v.left+20&&s.right<=v.right-20&&s.top>=v.top+20&&s.bottom<=v.bottom-20;
    });
  }
  await page.setViewportSize({width:1720,height:1600});await trail.getByRole('button',{name:'Home',exact:true}).click();await settle();
  const organisation=await addresses();assert.equal(Object.keys(organisation).length,9);
  await screenshot('01-organisation');
  const role=project.documents.find(d=>/Student Affairs/.test(d.role));
  const container=model.containers.find(c=>c.source.documentId===role.id);
  const roleTile=tiles.getByText(container.title,{exact:true});await roleTile.click();
  await inspector.getByRole('heading',{name:container.title,exact:true}).waitFor();
  await visibleSelection();
  await inspector.getByRole('button',{name:/^Open /}).click();
  const dimensions=await addresses();
  await screenshot('02-role-dimensions');
  await app.locator('.dl-tile').filter({hasText:'Domain 1: Operational Supervision Duties'}).dblclick();
  const responsibilities=await addresses(),beforeCamera=await camera();
  await screenshot('03-responsibilities');
  const p=role.passages.find(p=>p.text.includes('Serve as the first point of contact for students (only)'));
  await app.getByRole('button',{name:p.text,exact:true}).click();
  await inspector.locator('blockquote').waitFor();await visibleSelection();
  assert.equal(await inspector.locator('blockquote').innerText(),p.text);
  assert.equal(await inspector.locator('.dl-inspector-top .dl-eyebrow').textContent(),'Responsibility');
  assert.match(await inspector.getByRole('region',{name:'Documentary context'}).innerText(),/Student Affairs/);
  assert.equal(await inspector.evaluate(el=>{
    const text=el.querySelector('blockquote'),context=el.querySelector('.dl-inspector-context'),source=el.querySelector('.dl-inspector-provenance');
    return Boolean(text.compareDocumentPosition(context)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(context.compareDocumentPosition(source)&Node.DOCUMENT_POSITION_FOLLOWING);
  }),true);
  const stageBox=await app.locator('.dl-stage').boundingBox(),dockBox=await inspector.boundingBox(),workspaceBox=await app.locator('.dl-workspace').boundingBox();
  assert.ok(stageBox.x+stageBox.width<=dockBox.x);
  assert.ok(stageBox.width/workspaceBox.width>.63&&stageBox.width/workspaceBox.width<.71);
  await screenshot('04-docked-responsibility');
  await inspector.getByRole('button',{name:'Close inspector'}).click();await settle();
  assert.equal(await camera(),beforeCamera);assert.equal(await inspector.count(),0);
  assert.equal(await app.locator('.dl-stage h2').innerText(),'Domain 1: Operational Supervision Duties');
  assert.deepEqual(await addresses(),responsibilities);
  await trail.getByRole('button',{name:'← Back'}).click();assert.deepEqual(await addresses(),responsibilities);
  await trail.getByRole('button',{name:'← Back'}).click();assert.deepEqual(await addresses(),dimensions);
  await trail.getByRole('button',{name:'← Back'}).click();
  await trail.getByRole('button',{name:'Home',exact:true}).click();await settle();assert.deepEqual(await addresses(),organisation);
  await tiles.getByText(container.title,{exact:true}).dblclick();
  await app.locator('.dl-tile').filter({hasText:'Role description'}).dblclick();
  const descriptor=role.passages.find(p=>p.kind==='descriptor'&&p.dimension==='Unassigned — check source');
  await app.getByRole('button',{name:descriptor.text,exact:true}).click();await inspector.locator('blockquote').waitFor();
  assert.equal(await inspector.locator('blockquote').innerText(),descriptor.text);
  assert.equal(await inspector.locator('.dl-inspector-top .dl-eyebrow').textContent(),'Role description');
  assert.ok([...model.sections.values()].some(s=>s.containerId===container.id&&s.title==='Unassigned — check source'));
  await screenshot('05-role-description');
  await trail.getByRole('button',{name:'Home',exact:true}).click();await settle();
  await app.locator('.dl-viewport').focus();await app.locator('.dl-viewport').press('ArrowRight');const searchOrigin=await camera();
  await app.getByRole('searchbox',{name:'Search the documents'}).fill('Career Week');
  await app.getByRole('region',{name:'Search results'}).getByRole('button').first().click();await visibleSelection();
  const searchAddress=await app.locator('.dl-selected').getAttribute('data-address'),searchObject=await app.locator('.dl-selected').getAttribute('data-object-id');
  const statement=model.statements.get(searchObject),expected=layout(model,{sectionId:statement.sectionId}).find(t=>t.id===statement.id);
  assert.equal(searchAddress,`${expected.x},${expected.y}`);
  await screenshot('06-career-week-docked');
  await app.getByRole('button',{name:'Clear search'}).click();
  assert.equal(await app.locator('.dl-selected').getAttribute('data-address'),searchAddress);
  await trail.getByRole('button',{name:'← Back'}).click();await settle();assert.equal(await camera(),searchOrigin);
  await trail.getByRole('button',{name:'Home',exact:true}).click();assert.deepEqual(await addresses(),organisation);
  await page.reload();
  await page.getByRole('searchbox',{name:'Find a page'}).fill('Nervous Breakdown');
  await page.getByRole('navigation',{name:'Application',exact:true}).getByRole('button',{name:'Nervous Breakdown',exact:true}).click();
  await tiles.first().waitFor();await settle();assert.deepEqual(await addresses(),organisation);
  // A search from an already open inspector must not reuse the old section's camera.
  await app.getByRole('searchbox',{name:'Search the documents'}).fill('Career Week');
  await app.getByRole('region',{name:'Search results'}).getByRole('button').first().click();await visibleSelection();
  await app.getByRole('searchbox',{name:'Search the documents'}).fill('first point of contact for students (only)');
  await app.getByRole('region',{name:'Search results'}).getByRole('button').filter({hasText:'first point of contact for students (only)'}).click();await visibleSelection();
  await inspector.getByRole('button',{name:'Close inspector'}).click();await settle();
  assert.equal(await app.locator('.dl-stage h2').innerText(),'Domain 1: Operational Supervision Duties');
  assert.equal(await camera(),'transform: translate(32px, 32px) scale(1);');
  for(const width of [1200,800,430]){
    await page.setViewportSize({width,height:1100});await trail.getByRole('button',{name:'Home',exact:true}).click();
    await app.getByRole('searchbox',{name:'Search the documents'}).fill('Career Week');
    await app.getByRole('region',{name:'Search results'}).getByRole('button').first().click();await visibleSelection();
    const stage=await app.locator('.dl-stage').boundingBox(),dock=await inspector.boundingBox();
    assert.ok(stage.width>=280);assert.ok(dock.y>=stage.y+stage.height||dock.x>=stage.x+stage.width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await inspector.getByRole('button',{name:'Close inspector'}).click();assert.equal(await inspector.count(),0);
  }
  fs.writeFileSync(path.join(out,'real-acceptance.json'),JSON.stringify({passed:true,organisation,dimensions,responsibilities,
    unchangedDescriptorDimension:descriptor.dimension,selectedSourceExact:true,desktopDockRatio:stageBox.width/workspaceBox.width,
    responsiveWidths:[1200,800,430],reloadStable:true,searchAddressStable:true,closeRestoresCamera:true,backRestoresSearchCamera:true},null,2));
};
