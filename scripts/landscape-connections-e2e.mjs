import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from '../apps/launcher/node_modules/vite/dist/node/index.js';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'diagnostics/landscape-phase2a');
fs.mkdirSync(out,{recursive:true});const harness=fs.mkdtempSync(path.join(out,'synthetic-')),slash=p=>p.replaceAll('\\','/');
fs.writeFileSync(path.join(harness,'index.html'),'<html><body style="margin:0"><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>');
fs.writeFileSync(path.join(harness,'entry.jsx'),`
import React from 'react';import{createRoot}from'react-dom/client';
import Landscape from ${JSON.stringify(slash(path.join(root,'apps/principaled/src/documentary-landscape/DocumentaryLandscape.jsx')))};
import{connectionFixture}from ${JSON.stringify(slash(path.join(root,'scripts/landscape-connection-fixtures.mjs')))};
const q=new URLSearchParams(location.search),count=Number(q.get('count')),fixture=connectionFixture(count,true),{model,statement,records}=fixture;
if(q.has('policy')){model.containers[0].source.documentType='Policy';model.containers[0].labels={container:'Policy',section:'Section',statement:'Statement'};}
window.requests=[];window.fixture={count,containers:model.containers.length,statements:model.statements.size,destinationId:model.containers[1].id};
const sourceReader=async(url)=>{
 window.requests.push(url);const id=decodeURIComponent(new URL(url,'http://fixture').pathname.split('/').pop());
 const s=[...model.statements.values()].find(s=>s.passageId===id);
 return url.includes('/connections/')?{revision:model.revision,records:s.id===statement.id?records:[]}:{source:{before:'',text:s.text,after:''}};
};
createRoot(document.getElementById('root')).render(<Landscape model={model} sourceReader={sourceReader}/>);
`);
await build({configFile:false,root:harness,resolve:{alias:{react:path.join(root,'apps/launcher/node_modules/react'),'react-dom':path.join(root,'apps/launcher/node_modules/react-dom')},dedupe:['react','react-dom']},build:{outDir:path.join(harness,'dist')}});
const dist=path.join(harness,'dist'),server=http.createServer((req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname,file=path.resolve(dist,'.'+(route==='/'?'/index.html':route));
 if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 for(const count of [1,5,20,100]){
  const page=await browser.newPage({viewport:{width:1500,height:1100},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?count=${count}${count===5?'&policy':''}`);
  const app=page.locator('.dl'),inspector=app.getByRole('complementary',{name:'Source inspector'});
  await app.locator('.dl-tile').first().waitFor();
  assert.equal((await page.evaluate(()=>window.requests)).length,0);
  await app.getByRole('searchbox',{name:'Search the documents'}).fill('Relationship fixture origin');
  await app.getByRole('region',{name:'Search results'}).getByRole('button').first().click();
  await inspector.getByRole('button',{name:'Show connections',exact:true}).waitFor();
  const address=await app.locator('.dl-selected').getAttribute('data-address'),start=performance.now();
  await inspector.getByRole('button',{name:'Show connections',exact:true}).click();
  const portals=app.getByRole('region',{name:'Documentary destinations'}),list=inspector.getByRole('region',{name:'Documented connections'});
  assert.equal(await portals.getByRole('button').count(),Math.min(3,count));
  const shownMs=performance.now()-start,seen=new Set();
  do{
   for(const id of await list.locator('li').evaluateAll(nodes=>nodes.map(n=>n.dataset.connectionId)))seen.add(id);
   assert.ok(await list.locator('li').count()<=8);
   const next=list.getByRole('button',{name:'Next connections'});
   if(!await next.count()||await next.isDisabled())break;
   await next.click();
  }while(seen.size<count);
  assert.equal(seen.size,count);assert.equal(await app.locator('.dl-selected').getAttribute('data-address'),address);
  assert.equal((await page.evaluate(()=>window.requests.filter(r=>r.includes('/connections/')))).length,1);
  await portals.getByRole('button').first().click();
  assert.equal(await portals.count(),0);assert.equal(await app.locator('.dl-selected').getAttribute('data-object-id'),await page.evaluate(()=>window.fixture.destinationId));
  await app.getByRole('button',{name:'← Back',exact:true}).click();assert.equal(await portals.getByRole('button').count(),Math.min(3,count));
  assert.equal(await list.locator('li').last().getAttribute('data-connection-id'),`synthetic-connection-${count-1}`);
  await page.setViewportSize({width:600,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await inspector.getByRole('button',{name:'Hide connections',exact:true}).click();assert.equal(await portals.count(),0);
  await app.getByRole('button',{name:'Home',exact:true}).click();assert.equal(await app.locator('.dl-arrival').count(),0);
  assert.deepEqual(errors,[]);results.push({...await page.evaluate(()=>window.fixture),shownMs,maximumPortals:Math.min(3,count),maximumListRows:Math.min(8,count),seen:seen.size,browserErrors:errors});
  await page.close();
 }
 fs.writeFileSync(path.join(out,'browser-scale.json'),JSON.stringify(results,null,2));console.log('CONNECTION_SCALE_OK',results);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
