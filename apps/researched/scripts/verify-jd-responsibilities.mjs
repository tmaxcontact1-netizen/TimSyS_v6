import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {createResearchServer} from '../dist/src/entrypoints/api.js';
import {findBrowserExecutable} from '../dist/src/application/source-acquisition.js';
const fixture=process.env.JD_FIXTURE_ZIP;if(!fixture)throw Error('Set JD_FIXTURE_ZIP to the supplied JD archive.');
const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(tmpdir(),'researched-jd-')),out=join(root,'verification-local','jd-tool');await mkdir(out,{recursive:true});
let dbCalls=0;const database={query(){dbCalls++;throw Error('JD tool must not touch databases');},connect(){dbCalls++;throw Error('JD tool must not touch databases');}};
const server=createResearchServer({database,storageRoot:temp,publicDirectory:join(root,'dist/frontend'),backgroundQueue:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
// The existing host performs one unrelated startup recovery query against the rejecting stub.
assert.equal(dbCalls,1);dbCalls=0;
const checks=[];const pass=s=>{checks.push(s);console.log('PASS '+s);};let browser;
try{
 const req=async(path='',method='GET',value)=>{const r=await fetch(base+'/api/jd'+path,{method,...(value?{headers:{'content-type':'application/json'},body:JSON.stringify(value)}:{})});const d=await r.json();assert.equal(r.status<300,true,JSON.stringify(d));return d;};
 browser=await chromium.launch({headless:true,executablePath:findBrowserExecutable()});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForLoadState('networkidle');dbCalls=0;await page.getByRole('button',{name:/Roles and responsibilities/}).click();await page.waitForURL('**/?responsibilities');
 await page.getByRole('button',{name:'New collection',exact:true}).click();
 await page.getByLabel('Upload job descriptions').setInputFiles(fixture);
 await page.getByRole('button',{name:'Confirm extraction and explore'}).waitFor({timeout:90000});
 const list=await req();assert.equal(list.items.length,1);let p=await req('/'+list.items[0].id);assert.equal(p.documents.length,9);
 assert.equal(new Set(p.documents.map(d=>d.role)).size,9);assert.ok(p.documents.every(d=>d.role));
 for(const d of p.documents){for(const x of d.passages)assert.equal(d.extracted.slice(x.start,x.end),x.text);const original=Buffer.from(await(await fetch(base+`/api/jd/${p.id}/source/${d.id}`)).arrayBuffer());assert.equal(createHash('sha256').update(original).digest('hex'),d.sha256);}
 pass('Real ZIP upload: nine distinct JDs, exact extracted spans, preserved original-byte hashes and source locations');
 const coordinator=p.documents.find(d=>d.role==='AEA Coordinator'),aea=p.documents.find(d=>d.role==='AEA Teacher'),counselor=p.documents.find(d=>d.role==='School Counselor');
 assert.ok(coordinator.passages.some(x=>x.text.includes('Maintains and reviews the AEA enrollments')));
 assert.ok(aea.passages.some(x=>x.text.includes('Serves as primary contact for the parent')));
 assert.ok(counselor.passages.some(x=>x.dimension==='Referral Pathway'&&x.text.includes('refers the case')));
 await page.getByRole('button',{name:'Confirm extraction and explore'}).click();await page.getByRole('button',{name:'Special education intervention',exact:true}).click();
 await page.getByText('Serves as primary contact for the parent.',{exact:false}).first().waitFor();
 await page.getByRole('button',{name:'Relationships and gaps',exact:true}).click();await page.getByRole('heading',{name:'Connections not established'}).waitFor();
 await page.getByRole('button',{name:'Compare passage',exact:true}).nth(0).click();await page.getByRole('button',{name:'Compare passage',exact:true}).nth(0).click();await page.getByRole('heading',{name:'Passages selected for comparison — sequence unestablished'}).waitFor();
 pass('Special education retrieval retains parent-contact, enrolment and referral duties under original dimensions; disconnected duties can be compared without inventing a sequence');
 const exports={};for(const format of ['JSON','HTML','CSV']){const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download '+format,exact:true}).click()]);const path=join(out,'matrix.'+format.toLowerCase());await d.saveAs(path);exports[format]=await readFile(path,'utf8');}
 const exported=JSON.parse(exports.JSON);assert.equal(exported.documents.length,9);assert.ok(exported.matrix.rows.length>30);assert.ok(exported.matrix.rows.some(x=>x.role==='AEA Teacher'&&x.text.includes('primary contact')));
 assert.ok(exported.matrix.relationships.some(x=>x.role==='AEA Coordinator'&&x.label==='Reporting To'&&x.target.trim()==='Head of Schools'));
 assert.ok(!exported.matrix.relationships.some(x=>x.label==='Approves enrolment'));const chain=exported.matrix.reportingChains.find(x=>x.start==='AEA Teacher');assert.deepEqual(chain.links.map(x=>x.target.trim()),['AEA Coordinator','Head of Schools']);assert.ok(exported.matrix.reportingChains.some(x=>x.start==='Subject Leader'&&x.links[0].target.trim()==='Principal'&&x.links.length===1));
 assert.ok(exports.HTML.includes('Unresolved connections')&&exports.CSV.includes('Original extracted dimension')&&exports.CSV.includes('Reviewed dimension'));
 for(const link of exported.matrix.relationships){const doc=exported.documents.find(d=>d.id===link.documentId);assert.ok(link.evidence.length);for(const e of link.evidence){assert.equal(doc.extracted.slice(e.start,e.end),e.text);assert.ok(exports.HTML.includes(e.text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')));}}
 const sourceDetails=page.locator('details').filter({has:page.locator('summary',{hasText:'View exact source wording'})}).first();await sourceDetails.locator('summary').click();assert.ok((await sourceDetails.locator('pre').first().textContent()).trim());
 await page.getByRole('heading',{name:'Documented reporting chains' ,exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'connections.png'),fullPage:false});pass('JSON/HTML/CSV exports preserve source provenance, literal fields, original dimensions and unresolved-connection limits');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('heading',{name:'Check extraction'}).waitFor();await page.getByRole('button',{name:'Redo',exact:true}).click();await page.getByRole('button',{name:'Download JSON',exact:true}).waitFor();
 p=await req('/'+p.id);const stale=await fetch(base+'/api/jd/'+p.id+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:p.revision-1,review:p.review})});assert.equal(stale.status,400);
 const invented=await fetch(base+'/api/jd/'+p.id+'/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:p.revision,review:{...p.review,roles:{[p.documents[0].id]:'Invented approval authority'}}})});assert.equal(invented.status,400);
 const cross=await fetch(base+'/api/jd/'+p.id+'/undo',{method:'POST',headers:{'content-type':'application/json',origin:'https://invalid.example'},body:JSON.stringify({revision:p.revision})});assert.equal(cross.status,403);
 pass('Confirmation undo/redo, stale-revision rejection and cross-origin mutation protection');
 await page.getByRole('button',{name:'Edit extraction',exact:true}).click();page.on('dialog',d=>d.accept());const removed=p.documents[0].id;
 await Promise.all([page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().includes('/documents/')),page.getByRole('button',{name:'Delete source',exact:true}).click()]);p=await req('/'+p.id);assert.equal(p.documents.length,8);assert.equal(p.undo.length,0);assert.equal((await fetch(base+`/api/jd/${p.id}/source/${removed}`)).status,400);await assert.rejects(stat(join(temp,'jd-responsibilities',p.id,removed+'.bin')));
 await page.getByRole('button',{name:'Delete collection',exact:true}).click();await page.getByRole('button',{name:'New collection',exact:true}).waitFor();await assert.rejects(stat(join(temp,'jd-responsibilities',p.id)));assert.equal((await req()).items.length,0);assert.equal(dbCalls,0);assert.deepEqual(errors,[]);
 pass('Permanent source/collection deletion removes bytes and undo history; no database, MCF or AI calls');
 await writeFile(join(out,'verification.json'),JSON.stringify({at:new Date().toISOString(),checks,fixtureHash:createHash('sha256').update(await readFile(fixture)).digest('hex')},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
