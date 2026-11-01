// Read-only retrospective verification. No database, worker, sample creation or provider.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {McfValidation} from '../dist/src/application/mcf-validation.js';
import {reportHtml} from '../frontend/src/workbench/report.js';
import {renderReportPdf} from '../dist/src/application/report-pdf.js';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
const [source,expectedRun]=process.argv.slice(2);assert.ok(source&&expectedRun,'Usage: node scripts/verify-stored-review-report.mjs EXPORT.json RUN_ID');
const original=await readFile(source),archive=JSON.parse(original),report=archive.machineOutputs,session=archive.session;
assert.equal(report.run.id,expectedRun);assert.equal(report.run.status,'completed');
const hash=b=>createHash('sha256').update(b).digest('hex'),before=hash(original);
const sets=new Map(archive.unitSets.map(s=>[s.id,s.record_id]));
for(const u of session.units){assert.ok(u.original_text.trim());assert.ok(u.record_id);assert.equal(u.record_id,sets.get(u.unit_set_id));}
const byId=new Map([...session.contextUnits,...session.units].map(u=>[u.id,u]));let contextReferences=0;
for(const p of report.proposals){const target=byId.get(p.unit_id);assert.equal(p.payload.recordId,target.record_id);for(const c of p.payload.codes)for(const ref of c.context??[]){assert.equal(ref.recordId,target.record_id);assert.equal(sets.get(byId.get(ref.unitId).unit_set_id),target.record_id);contextReferences++;}}
const validation=new McfValidation({workspace:async()=>session,db:{query:async(sql)=>{assert.match(sql,/^SELECT payload FROM researched.mcf_report_snapshots/);return{rows:[{payload:report}]};}}});
const result=await validation.reviewReport(session.id,expectedRun),a=result.aggregation;
assert.deepEqual(result.evidenceLocationAnalysis,archive.evidentialCounts);
for(const c of a.competencies){assert.equal(c.reviewsRepresented,c.explicitReviews+c.contextualOnlyReviews);assert.equal(c.evidenceLocations,archive.evidentialCounts.find(e=>e.competencyId===c.competencyId).totalFindings);}
globalThis.fetch=()=>{throw Error('Report generation must not call a provider or network');};
const draft={step:5,useAi:true,title:session.title,machineRunId:expectedRun,decisions:Object.fromEntries(session.units.filter(u=>u.decision).map(u=>[u.id,u.decision])),confirmedAt:session.created_at};
const html=reportHtml({tool:'mcf',draft,session,instrument:archive.instrument,machine:{snapshot:report}});
assert.match(html,/<\/table><h2>Review-level analysis<\/h2>/);
const out=resolve('verification-local/review-aggregation',expectedRun);await mkdir(out,{recursive:true});
await writeFile(join(out,'report.html'),html);await writeFile(join(out,'review-level.json'),JSON.stringify(result,null,2));
const table=['| Competency | Reviews represented | Review prevalence % | Explicit reviews | Contextual-only reviews | Evidence density |','|---|---:|---:|---:|---:|---:|',...a.competencies.map(c=>`| ${c.competency} | ${c.reviewsRepresented} | ${c.reviewPrevalence.toFixed(2)} | ${c.explicitReviews} | ${c.contextualOnlyReviews} | ${c.evidenceDensity===null?'N/A':c.evidenceDensity.toFixed(2)} |`)].join('\n');
await writeFile(join(out,'review-table.md'),table);
const bytes=await renderReportPdf(html);await writeFile(join(out,'report.pdf'),bytes);
const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),pdf=await task.promise;let reviewPage=0;
for(let n=1;n<=Math.min(8,pdf.numPages);n++){const page=await pdf.getPage(n),text=(await page.getTextContent()).items.map(x=>x.str??'').join(' ');if(text.includes('Review-level analysis')){reviewPage=n;break;}}
assert.ok(reviewPage,'PDF contains review table');
for(let n=reviewPage;n<=Math.min(reviewPage+1,pdf.numPages);n++){const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.4}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await writeFile(join(out,`page-${n}.png`),canvas.toBuffer('image/png'));}
const pages=pdf.numPages;await task.destroy();assert.equal(hash(await readFile(source)),before);
await writeFile(join(out,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),runId:expectedRun,sourceSha256:before,sourceUnchanged:true,substantiveUnits:session.units.length,eligibleDistinctReviews:a.eligibleReviews,contextReferences,validationCandidateAccepted:true,validationSampleCreated:false,semanticCalls:0,pdfPages:pages,reviewTablePage:reviewPage},null,2));
console.log(JSON.stringify({out,substantiveUnits:session.units.length,eligibleDistinctReviews:a.eligibleReviews,contextReferences,pdfPages:pages,reviewTablePage:reviewPage}));console.log(table);
