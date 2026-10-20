import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from '../apps/launcher/node_modules/vite/dist/node/index.js';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'diagnostics/landscape-phase1');
const harness=fs.mkdtempSync(path.join(out,'synthetic-ui-')),slash=p=>p.replaceAll('\\','/');
fs.writeFileSync(path.join(harness,'index.html'),'<html><head><title>Synthetic documentary navigation test</title></head><body style="margin:0;background:#edf0ea"><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>');
fs.writeFileSync(path.join(harness,'entry.jsx'),`
import React from 'react';import{createRoot}from'react-dom/client';
import Landscape from ${JSON.stringify(slash(path.join(root,'apps/principaled/src/documentary-landscape/DocumentaryLandscape.jsx')))};
import{fromJd}from ${JSON.stringify(slash(path.join(root,'apps/principaled/src/documentary-landscape/model.ts')))};
import{jdFixture,policyFixture}from ${JSON.stringify(slash(path.join(root,'scripts/landscape-fixtures.mjs')))};
const large=location.search.includes('large'),policy=location.search.includes('policy');
const start=performance.now(),model=policy?policyFixture():fromJd(jdFixture(large?200:50,large?25000:5000));
window.fixture={roles:model.containers.length,statements:model.statements.size,adaptMs:performance.now()-start};
const sourceReader=async(url)=>({source:{before:'Synthetic source context.\\n',text:[...model.statements.values()].find(s=>s.passageId===decodeURIComponent(new URL(url,'http://fixture').pathname.split('/').pop())).text,after:'\\nSynthetic source context.'}});
createRoot(document.getElementById('root')).render(<Landscape model={model} sourceReader={sourceReader}/>);
`);
await build({configFile:false,root:harness,resolve:{alias:{react:path.join(root,'apps/launcher/node_modules/react'),'react-dom':path.join(root,'apps/launcher/node_modules/react-dom')},dedupe:['react','react-dom']},build:{outDir:path.join(harness,'dist')}});
const dist=path.join(harness,'dist'),server=http.createServer((req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(dist,'.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
  for(const kind of ['medium','large','policy']) {
    const page=await browser.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.longTasks=[];new PerformanceObserver(list=>window.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});});
    const start=performance.now();await page.goto(`http://127.0.0.1:${server.address().port}/?${kind}`);
    const app=page.locator('.dl');await app.locator('.dl-tile').first().waitFor();
    const firstVisibleMs=performance.now()-start,tiles=await app.locator('.dl-tile').count();
    if(kind!=='policy')assert.ok(tiles<=12);
    assert.equal(await app.locator('.dl-statement').count(),0);
    // Search index can build in the background while pan remains available.
    await app.locator('.dl-viewport').focus();await app.locator('.dl-viewport').press('ArrowDown');
    await app.getByRole('button',{name:'Home',exact:true}).click();
    await app.locator('[role=status]').waitFor({state:'detached',timeout:30000});
    const readyMs=performance.now()-start;
    if(kind==='large')await app.screenshot({path:path.join(out,'06-large-synthetic.png')});
    const query=kind==='policy'?'policy statement 3.6':'Scale search destination';
    const before=performance.now();await app.getByRole('searchbox',{name:'Search the documents'}).fill(query);
    const result=app.getByRole('region',{name:'Search results'}).getByRole('button').first();
    await result.waitFor();const searchAndDebounceMs=performance.now()-before;await result.click();
    const inspector=app.getByRole('complementary',{name:'Source inspector'});await inspector.waitFor();
    assert.match(await inspector.locator('blockquote').innerText(),kind==='policy'?/policy statement 3.6/:/Scale search destination/);
    assert.ok(await app.locator('.dl-statement').count()<=12);
    if(kind==='policy') {
      assert.match(await inspector.innerText(),/Policy/);assert.doesNotMatch(await inspector.innerText(),/Original dimension|Responsibility|Role/);
      await inspector.getByRole('button',{name:'View Source',exact:true}).click();
      await inspector.locator('mark').waitFor();
      assert.equal(await inspector.locator('mark').innerText(),await inspector.locator('blockquote').innerText());
      await app.screenshot({path:path.join(out,'07-synthetic-policy.png')});
      await app.getByRole('button',{name:'← Back',exact:true}).click();
    }
    const back=app.getByRole('button',{name:'← Back',exact:true});
    await back.click();assert.equal(await inspector.count(),0);
    assert.equal(await app.locator('.dl-statement').count(),0);
    assert.equal(await app.locator('.dl-stage h2').innerText(),'The documentary landscape');
    await app.getByRole('button',{name:'Home',exact:true}).click();
    assert.deepEqual(errors,[]);
    results.push({kind,...await page.evaluate(()=>window.fixture),initialTiles:tiles,firstVisibleMs,searchReadyMs:readyMs,searchAndDebounceMs,maxMainThreadLongTaskMs:await page.evaluate(()=>Math.max(0,...window.longTasks)),browserErrors:errors});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'browser-scale.json'),JSON.stringify(results,null,2));console.log('LANDSCAPE_SCALE_OK',results);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
