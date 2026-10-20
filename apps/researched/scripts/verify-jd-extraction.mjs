import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extractJd,unpackJds} from '../dist/src/application/jd-documents.js';
import {jdMatrix} from '../dist/src/domain/jd-matrix.js';
const fixture=process.env.JD_FIXTURE_ZIP;if(!fixture)throw Error('Set JD_FIXTURE_ZIP');
const out=new URL('../verification-local/jd-extraction-v2/',import.meta.url);await mkdir(out,{recursive:true});
const before=JSON.parse(await readFile(new URL('before.json',out),'utf8'));
const entries=await unpackJds(await readFile(fixture),'jds.zip'),docs=[];
for(const entry of entries){const d=await extractJd(entry.bytes,entry.filename);docs.push(d);assert.equal(d.sha256,createHash('sha256').update(entry.bytes).digest('hex'));for(const p of d.passages)assert.equal(d.extracted.slice(p.start,p.end),p.text);if(d.physicalLines){const spans=d.passages.flatMap(p=>p.sourceSpans??[]);assert.equal(spans.length,d.physicalLines.length);assert.equal(new Set(spans.map(s=>s.lineId)).size,spans.length);for(const p of d.passages)assert.equal(p.text,p.sourceSpans.map(s=>d.rawExtracted.slice(s.start,s.end).trim()).join(' '));}else{const old=before.find(x=>x.filename===d.filename);assert.deepEqual(d.passages.map(p=>[p.text,p.start,p.end,p.location,p.dimension]),old.passages.map(p=>[p.text,p.start,p.end,p.location,p.dimension]));}}
const named=needle=>docs.find(d=>d.filename.includes(needle));
const coord=named('AEA Coordinator'),teacher=named('AEA Teacher'),counselor=named('School Counselor'),behavior=named('Behavioral Interventionist');
const summary=coord.passages.filter(p=>p.dimension==='Job Summary'&&p.kind==='descriptor');assert.equal(summary.length,1);assert.equal(summary[0].kind,'descriptor');assert.ok(summary[0].text.endsWith('areas.'));assert.equal(summary[0].sourceSpans.length,6);
const cs=counselor.passages.filter(p=>p.dimension==='Job Summary'&&p.kind==='descriptor');assert.equal(cs.length,2);assert.ok(cs.every(p=>p.kind==='descriptor'&&p.sourceSpans.length>1));
const bs=behavior.passages.filter(p=>p.dimension==='Job Scope'&&p.kind==='descriptor');assert.equal(bs.length,2);assert.ok(bs.every(p=>p.kind==='descriptor'&&p.sourceSpans.length>1));
const qualifications=teacher.passages.filter(p=>p.kind==='qualification');assert.equal(qualifications.length,5);assert.ok(qualifications.every(p=>!p.dimension.includes('parent')));assert.ok(teacher.warnings.some(w=>w.includes('heading is absent')));
for(const d of docs){assert.ok(d.passages.filter(p=>p.kind==='statement').every(p=>!/^_+|^Name:|^Signature:/.test(p.text)));}
const compound=coord.passages.filter(p=>p.text.includes('Recruits, hires, supervises, and evaluates'));assert.equal(compound.length,1);assert.equal(compound[0].kind,'statement');
const review={roles:{},excluded:[],confirmed:false},matrix=jdMatrix(docs,review);assert.ok(matrix.rows.some(p=>p.kind==='descriptor'));assert.ok(matrix.rows.every(p=>['statement','descriptor'].includes(p.kind)));
assert.equal(matrix.reportingChains.find(c=>c.start==='Middle School Behavioral Interventionist').links.length,1);assert.equal(matrix.reportingChains.find(c=>c.start==='Subject Leader').links.length,1);
const counts=docs.map(d=>({filename:d.filename,beforeUnits:before.find(x=>x.filename===d.filename).passages.length,afterUnits:d.passages.length,beforeResponsibilityRows:before.find(x=>x.filename===d.filename).passages.filter(p=>p.kind==='statement').length,levels:d.passages.reduce((a,p)=>(a[p.kind]=(a[p.kind]??0)+1,a),{}),ambiguities:d.passages.filter(p=>p.ambiguity).map(p=>({location:p.location,text:p.text,ambiguity:p.ambiguity})),warnings:d.warnings}));
await writeFile(new URL('after.json',out),JSON.stringify(docs,null,2));await writeFile(new URL('verification.json',out),JSON.stringify({at:new Date().toISOString(),counts},null,2));console.log(JSON.stringify(counts.map(({warnings,...c})=>c),null,2));console.log('PASS nine originals, complete physical-line provenance, four unchanged DOCX structures, summaries, qualifications, signatures, compound bullets and distinct role titles');
