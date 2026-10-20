// Isolated browser verification. No real AI calls, credentials or application records.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(root,'diagnostics','ai-ui-compatibility-'));
Object.assign(process.env,{NODE_ENV:'test',PORT:'0',DB_PATH:path.join(out,'isolated.sqlite'),JWT_SECRET:'ai-ui-test-jwt-secret-only-32-characters',REFRESH_TOKEN_SECRET:'ai-ui-test-refresh-secret-only-32-characters',TIMSYS_LAUNCHER_DIST:path.join(root,'apps/launcher/dist'),RATE_LIMIT_DEFAULT:'10000',RATE_LIMIT_ADMIN:'10000'});
const {chromium}=require(path.join(require('os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const platform=require(process.env.PRINCIPALED_VERIFY_PLATFORM||'../platform');
let server,browser;
(async()=>{
  const dist=path.join(root,'apps/launcher/dist');
  assert.equal(fs.readFileSync(path.join(dist,'assistant.html'),'utf8'),fs.readFileSync(path.join(dist,'index.html'),'utf8'));
  server=await platform.bootPlatform();const origin=`http://127.0.0.1:${server.address().port}`;
  const {token}=await fetch(origin+'/api/auth/dev-login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:'{}'}).then(r=>r.json());
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(token=>{
    localStorage.setItem('jwt_token',token);
    window.settingsOpened=0;
    window.electronAPI={assistant:{
      profiles:async()=>({profiles:[],appConnections:[]}),
      openSettings:async()=>{window.settingsOpened++;},
      onSettings:()=>()=>{},close:()=>{}
    }};
  },token);
  await page.route('**/ai-gateway/**',route=>{
    const url=new URL(route.request().url());
    const data=url.pathname.endsWith('/assistant')?{success:true,configured:false}:{success:true,conversations:[]};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(origin+'/');await page.getByRole('button',{name:/AI Integration Connect/}).click();
  assert.equal(await page.evaluate(()=>window.settingsOpened),1);checks.push('Launcher AI Integration invokes the existing desktop settings bridge');
  await page.goto(origin+'/assistant?settings=connections');
  await page.getByRole('heading',{name:'AI Integration',exact:true}).waitFor();
  await page.getByRole('tab',{name:'API connections',exact:true}).click();
  await page.getByText('Connect a provider using an API key.',{exact:true}).waitFor();
  checks.push('Dedicated assistant route renders existing account/API settings');
  await page.goto(origin+'/assistant?app=principal-ed');
  await page.getByRole('textbox',{name:'Message TimSyS AI'}).waitFor();
  checks.push('PrincipalEd assistant conversation UI remains available');
  await page.goto(origin+'/app/principal-ed');
  await page.getByRole('searchbox',{name:'Find a page'}).fill('Nervous Breakdown');
  await page.getByRole('navigation',{name:'Application',exact:true}).getByRole('button',{name:'Nervous Breakdown',exact:true}).click();
  const content=page.locator('#school-content');
  await content.getByText('No documentary collection is available. Job descriptions prepared in Research’Ed will appear here for read-only exploration.',{exact:true}).waitFor();
  assert.equal(await content.getByRole('tab').count(),0);
  checks.push('Nervous Breakdown remains empty with no retired model controls');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,'empty-model.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks,browserErrors:errors,isolatedDatabase:process.env.DB_PATH,mockedAiOnly:true},null,2));
  console.log('AI_UI_COMPATIBILITY_OK '+out);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await platform.shutdownPlatform(server);});
