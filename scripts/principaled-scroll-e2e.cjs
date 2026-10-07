// Real UI and APIs against an isolated synthetic database. Never uses installed data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(repo,'diagnostics','principaled-scroll-'));
process.env.NODE_ENV='test';process.env.PORT='0';process.env.DB_PATH=path.join(out,'synthetic.sqlite');process.env.JWT_SECRET='usability-isolated-browser-test-secret-32-chars';process.env.REFRESH_TOKEN_SECRET='usability-isolated-refresh-test-secret-32-chars';process.env.TIMSYS_LAUNCHER_DIST=path.join(repo,'apps/launcher/dist');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(require('os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const platform=require('../platform');let server,browser;
(async()=>{
 server=await platform.bootPlatform();const origin=`http://127.0.0.1:${server.address().port}`;
 const {token}=await fetch(origin+'/api/auth/dev-login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:'{}'}).then(r=>r.json());
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(token=>localStorage.setItem('jwt_token',token),token);
 await page.goto(origin+'/app/principal-ed');await page.locator('.school-home h1').waitFor({timeout:30000});
 const content=page.locator('#school-content'),nav=page.getByRole('navigation',{name:'Application',exact:true});

 await page.getByRole('searchbox',{name:'Find a page'}).fill('Nervous Breakdown');await nav.getByRole('button',{name:'Responsibilities',exact:true}).click();
 await content.getByRole('heading',{name:'Nervous Breakdown',exact:true}).waitFor();
 await content.getByRole('button',{name:'Filters / Advanced',exact:true}).click();
 for(const viewport of [{width:1440,height:600},{width:390,height:660}]){
  await page.setViewportSize(viewport);
  for(const view of ['2D Network','List']){
   await content.getByRole('tab',{name:view,exact:true}).click();
   // Real wheel input outside the canvas must scroll the page, not zoom the graph.
   const box=await content.boundingBox();const metrics=await content.evaluate(el=>({height:el.clientHeight,full:el.scrollHeight}));
   assert.ok(metrics.height<=viewport.height-54,'page scroll area must fit below the fixed header');
   assert.ok(metrics.full>metrics.height,'fixture should exercise overflow');
   await content.focus();await page.keyboard.press('Control+Home');await page.waitForTimeout(200);
   await page.mouse.move(box.x+5,box.y+80);await page.mouse.wheel(0,800);await page.waitForTimeout(250);
   assert.ok(await content.evaluate(el=>el.scrollTop)>0,'wheel must scroll down');
   await page.mouse.wheel(0,-1800);await page.waitForTimeout(250);
   assert.equal(await content.evaluate(el=>el.scrollTop),0,'wheel must scroll back to top');
   await content.focus();await page.keyboard.press('Control+End');await page.waitForTimeout(250);
   assert.ok(await content.evaluate(el=>el.scrollTop+el.clientHeight>=el.scrollHeight-2),'keyboard must reach bottom');
   await page.screenshot({path:path.join(out,`${viewport.width}-${view.split(' ')[0]}-bottom.png`)});
   await page.keyboard.press('Control+Home');await page.waitForTimeout(200);
   checks.push(`${viewport.width}px ${view}: wheel up/down and keyboard reach bottom`);
  }
 }
 await page.setViewportSize({width:1440,height:800});await content.focus();await page.keyboard.press('Control+End');await page.waitForTimeout(200);
 await page.getByRole('searchbox',{name:'Find a page'}).fill('Documents');await nav.getByRole('button',{name:'Documents',exact:true}).click();await content.getByRole('heading',{name:'Documents',exact:true}).waitFor();
 assert.equal(await content.evaluate(el=>el.scrollTop),0,'new pages start at the top');checks.push('navigation resets page scroll');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,syntheticOnly:true,checks,browserErrors:errors,productionDatabaseTouched:false},null,2));console.log('PRINCIPALED_SCROLL_PASS '+out);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await platform.shutdownPlatform(server);});
