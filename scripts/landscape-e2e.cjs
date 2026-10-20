// Runs a disposable platform and a read-only COPY of the real documentary snapshot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'diagnostics/landscape-phase1');
fs.mkdirSync(out,{recursive:true});
const corpus=process.env.NB_ACCEPTANCE_PROJECT;
if(!corpus)throw Error('Set NB_ACCEPTANCE_PROJECT to the existing project.json for read-only acceptance.');
const original=fs.readFileSync(corpus),project=JSON.parse(original);
const store=fs.mkdtempSync(path.join(out,'source-copy-'));fs.mkdirSync(path.join(store,project.id));
fs.writeFileSync(path.join(store,project.id,'project.json'),original);
Object.assign(process.env,{NODE_ENV:'test',PORT:'0',DB_PATH:path.join(store,'isolated.sqlite'),NB_DOCUMENTARY_ROOT:store,
  JWT_SECRET:'landscape-isolated-jwt-secret-32-characters',REFRESH_TOKEN_SECRET:'landscape-isolated-refresh-secret-32-characters',
  TIMSYS_LAUNCHER_DIST:path.join(root,'apps/launcher/dist'),RATE_LIMIT_DEFAULT:'10000',RATE_LIMIT_ADMIN:'10000'});
const platform=require(process.env.PRINCIPALED_VERIFY_PLATFORM||'../platform');
const {chromium}=require(path.join(require('os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
let server,browser;
(async()=>{
  server=await platform.bootPlatform();const origin=`http://127.0.0.1:${server.address().port}`;
  assert.ok(![18860,18861].includes(server.address().port));
  const unauth=await fetch(origin+'/nervous-breakdown/collections');assert.ok([401,403].includes(unauth.status));
  const {token}=await fetch(origin+'/api/auth/dev-login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:'{}'}).then(r=>r.json());
  const headers={Authorization:`Bearer ${token}`};
  const response=await fetch(origin+`/nervous-breakdown/collections/${project.id}`,{headers}).then(r=>r.json());
  assert.equal(response.success,true);
  const {fromJd}=await import('../apps/principaled/src/documentary-landscape/model.ts');
  const model=fromJd(response.snapshot);
  // Compare against the unchanged, authoritative reviewed projection, not hand-authored expectations.
  const {reviewedPassages}=await import('../../researched-content-analysis/apps/researched/dist/src/domain/jd-matrix.js');
  const expected=project.documents.flatMap(d=>reviewedPassages(d,project.review).filter(p=>['statement','descriptor'].includes(p.kind)&&!project.review.excluded.includes(p.id)));
  assert.equal(model.statements.size,expected.length);
  for(const p of expected){const s=[...model.statements.values()].find(s=>s.passageId===p.id);assert.equal(s.text,p.text);assert.equal(model.sections.get(s.sectionId).title,p.dimension);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1720,height:1600},reducedMotion:'reduce'}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/nervous-breakdown')&&r.method()!=='GET')writes.push(r.url());});
  await page.addInitScript(token=>localStorage.setItem('jwt_token',token),token);
  await page.goto(origin+'/app/principal-ed');
  await page.getByRole('searchbox',{name:'Find a page'}).fill('Nervous Breakdown');
  await page.getByRole('navigation',{name:'Application',exact:true}).getByRole('button',{name:'Nervous Breakdown',exact:true}).click();
  const app=page.locator('.dl'),tiles=app.locator('.dl-tile'),trail=app.getByRole('navigation',{name:'Documentary location'});
  await tiles.first().waitFor();await app.screenshot({path:path.join(out,'01-organisation.png')});
  const teacher=tiles.filter({has:page.locator('strong',{hasText:/^Teacher$/})});
  await teacher.click();await app.getByRole('button',{name:'Open Teacher →',exact:true}).click();
  await app.locator('.dl-stage h2').filter({hasText:/^Teacher$/}).waitFor();
  await app.screenshot({path:path.join(out,'02-teacher.png')});
  await tiles.getByText('Standard 4: Assessment and Data-Informed Practice',{exact:true}).dblclick();
  await app.locator('.dl-stage h2').filter({hasText:'Standard 4: Assessment and Data-Informed Practice'}).waitFor();
  await app.screenshot({path:path.join(out,'03-dimension.png')});
  // Pan to the exact documentary tile if it is outside the current viewport.
  const target=project.documents.flatMap(d=>d.passages).find(p=>p.text.startsWith('Collaborate with AEA specialists'));
  const vp=app.locator('.dl-viewport');
  for(let i=0;i<8&&await tiles.filter({hasText:'Collaborate with AEA specialists'}).count()===0;i++){await vp.focus();await vp.press('ArrowDown');}
  await app.getByRole('button',{name:target.text,exact:true}).click();
  const inspector=app.getByRole('complementary',{name:'Source inspector'});
  assert.equal(await inspector.locator('blockquote').innerText(),target.text);
  await inspector.getByRole('button',{name:'View Source',exact:true}).click();
  await inspector.locator('mark').waitFor();assert.equal(await inspector.locator('mark').innerText(),target.text);
  await app.screenshot({path:path.join(out,'04-responsibility-source.png')});
  await trail.getByRole('button',{name:'← Back',exact:true}).click();assert.equal(await inspector.locator('mark').count(),0);
  await trail.getByRole('button',{name:'← Back',exact:true}).click();assert.equal(await inspector.count(),0);
  await trail.getByRole('button',{name:'← Back',exact:true}).click();assert.equal(await app.locator('.dl-stage h2').innerText(),'Teacher');
  await trail.getByRole('button',{name:'← Back',exact:true}).click();assert.equal(await app.locator('.dl-stage h2').innerText(),'The documentary landscape');
  const searchOrigin=await app.locator('.dl-world').getAttribute('style');
  await app.getByRole('searchbox',{name:'Search the documents'}).fill('Career Week');
  const result=app.getByRole('region',{name:'Search results'}).getByRole('button').filter({hasText:'Student Affairs'});
  await result.waitFor();await result.click();
  assert.match(await inspector.locator('h2').innerText(),/Student Affairs/);
  assert.match(await inspector.locator('blockquote').innerText(),/Career Week/);
  await app.screenshot({path:path.join(out,'05-career-week.png')});
  await trail.getByRole('button',{name:'← Back',exact:true}).click();
  assert.equal(await app.locator('.dl-world').getAttribute('style'),searchOrigin);
  assert.equal(await app.locator('.dl-stage h2').innerText(),'The documentary landscape');
  await trail.getByRole('button',{name:'Home',exact:true}).click();
  await tiles.getByText('Teacher',{exact:true}).click();
  for(let i=0;i<5&&await app.locator('.dl-stage h2').innerText()==='The documentary landscape';i++)await app.getByRole('button',{name:'Zoom in',exact:true}).click();
  assert.equal(await app.locator('.dl-stage h2').innerText(),'Teacher');
  await trail.getByRole('button',{name:'Home',exact:true}).click();
  assert.equal(await app.getByRole('searchbox',{name:'Search the documents'}).inputValue(),'');
  // Breadcrumb return, zoom detail, and lateral pan are actual browser interactions.
  await tiles.getByText('Teacher',{exact:true}).dblclick();
  await trail.getByRole('button',{name:'Organisation',exact:true}).click();
  await app.getByRole('button',{name:'Zoom in',exact:true}).click();
  await app.getByRole('button',{name:'Zoom in',exact:true}).click();
  assert.ok(await app.locator('.dl-preview').count()>0);
  await app.getByRole('button',{name:'Reset view',exact:true}).click();
  const before=await app.locator('.dl-world').getAttribute('style');
  await vp.focus();await vp.press('ArrowRight');
  assert.notEqual(await app.locator('.dl-world').getAttribute('style'),before);
  await trail.getByRole('button',{name:'Home',exact:true}).click();
  await page.setViewportSize({width:800,height:850});
  await app.getByRole('searchbox',{name:'Search the documents'}).fill('assessment accommodations');
  await app.getByRole('region',{name:'Search results'}).getByRole('button').first().click();
  await inspector.scrollIntoViewIfNeeded();assert.equal(await inspector.isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  assert.deepEqual(fs.readFileSync(corpus),original);
  const summary={passed:true,documents:model.containers.length,statements:model.statements.size,sections:model.sections.size,revision:response.snapshot.revision,
    corpusSha256:crypto.createHash('sha256').update(original).digest('hex'),frozenProjectionParity:true,
    checks:['real Teacher → Standard 4 → exact assessment accommodation → source','Back through each context','Career Week → Student Affairs → Home','clickable Organisation breadcrumb','zoom previews','keyboard pan','800px responsive inspector and page width','unauthenticated access denied','no documentary write requests','original source snapshot unchanged'],browserErrors:errors};
  fs.writeFileSync(path.join(out,'browser-real.json'),JSON.stringify(summary,null,2));console.log('LANDSCAPE_REAL_OK',summary);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await platform.shutdownPlatform(server);});
