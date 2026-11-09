import {describe,it,expect} from 'vitest';
import {readContentPage,analyseContent,rankSupportingLinks} from '../src/application/content-reader.js';
import {contentPlanInput} from '../src/domain/content-analysis.js';
import {contentCsv} from '../src/entrypoints/content-api.js';
// Shared HTML is also the input to the existing PDF exporter.
import {reportHtml} from '../../../../apps/researched/frontend/src/workbench/report.js';
const meta={id:'page',requestedUrl:'https://coe.example.edu/med',hash:'hash',capturedAt:'2026-11-09',depth:0,parentUrl:null,reason:'test'};
const plan=contentPlanInput.parse({mode:'course-units',fields:['curriculum'],maxDepth:4,maxPages:30});
describe('course units only',()=>{
 it('excludes curriculum navigation headings and preserves subtitle punctuation in table units',async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>MEd</h1><h2>Explore the Curriculum</h2><p>Browse our offering.</p><table><tr><td>Spring 2 AD687 Defining Your Leadership Journey: A Beginner’s Mind (3cr.)</td></tr></table><p>See the academic catalogue.</p></main>'),'text/html',meta.requestedUrl,meta);
  const units=analyseContent([page],plan).courseUnits!;expect(units).toHaveLength(1);expect(units[0]!.title).toBe('Defining Your Leadership Journey: A Beginner’s Mind');expect(units[0]!.overview).toEqual([]);
 });
 it('exports titles and overviews rather than unrelated page prose, and retains dead links',async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>MEd</h1><p>Marketing slogan</p><h2>Curriculum</h2><h3>EDU 501 School Law: Policy and Practice</h3><p>Published overview.</p></main>'),'text/html',meta.requestedUrl,meta);
  const result=analyseContent([page],plan),csv=contentCsv({tasks:[{url:page.url,status:'completed',result},{url:'https://example.edu/old',status:'failed',error:{status:'missing'}}]});
  expect(csv).toContain('School Law: Policy and Practice');expect(csv).toContain('Published overview.');expect(csv).not.toContain('Marketing slogan');expect(csv).toContain('missing');
  const html=reportHtml({tool:'content',draft:{title:'Course units',confirmedAt:'2026-11-09'},run:{tasks:[{id:'task',url:page.url,result}]}});
  expect(html).toContain('School Law: Policy and Practice');expect(html).toContain('Published overview.');expect(html).not.toContain('Marketing slogan');expect(JSON.parse(JSON.stringify(result)).courseUnits).toEqual(result.courseUnits);
 });
 it('extracts codes, titles and verbatim overviews without general marketing or admissions',async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>MEd Leadership</h1><p>Become an inspiring leader.</p><h2>Curriculum</h2><h3>EDU 501 — School Law</h3><p>Examines legal responsibilities and policy.</p><p>Includes practical case studies.</p><h3>EDU 502 — Resource Management</h3><h2>Admissions</h2><p>Submit application ABC1234 and fees.</p></main>'),'text/html',meta.requestedUrl,meta);
  const r=analyseContent([page],plan);expect(r.courseUnits).toHaveLength(2);expect(r.courseUnits![0]).toMatchObject({code:'EDU 501',title:'School Law',overview:['Examines legal responsibilities and policy.','Includes practical case studies.']});expect(r.courseUnits![1]!.overview).toEqual([]);expect(r.ai.status).toBe('off');
 });
 it('preserves uncoded unit headings, listed titles, sections and source provenance',async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>Programme</h1><h2>Core modules</h2><h3>Leadership and Equity</h3><p>Explore access and participation.</p><h2>Elective courses</h2><ul><li>Reflective Leadership</li></ul></main>'),'text/html',meta.requestedUrl,meta);
  const r=analyseContent([page],plan);expect(r.courseUnits).toHaveLength(2);expect(r.courseUnits![0]!.sourceUrl).toBe(meta.requestedUrl);expect(r.courseUnits![0]!.evidenceIds).toHaveLength(2);
 });
 it('follows academic sibling catalogues but not unrelated hosts',()=>{
  const links=rankSupportingLinks('<a href="https://catalog.example.edu/preview_program.php?id=1">Academic Catalogue</a><a href="https://evil.edu/curriculum">Curriculum</a>',meta.requestedUrl,meta.requestedUrl,plan);
  expect(links.find(l=>l.url.includes('catalog.example.edu'))?.allowed).toBe(true);expect(links.find(l=>l.url.includes('evil.edu'))?.allowed).toBe(false);
 });
 it('does not change historical plans or reinterpret accreditation as units',async()=>{
  expect(contentPlanInput.parse({}).mode).toBe('general');const page=await readContentPage(Buffer.from('<main><h1>Accreditation standards</h1><h2>Curriculum</h2><li>EDU 501 Requirements</li></main>'),'text/html',meta.requestedUrl,meta);expect(analyseContent([page],plan).courseUnits).toEqual([]);
 });
 it('keeps archived catalogue section labels out of the unit list',async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>Archived programme</h1><h2>Research Courses (15 units):</h2><h3>P-12 Specialization:</h3><li>EDLD 751 Organizational Culture (3 units)</li></main>'),'text/html',meta.requestedUrl,meta);
  const units=analyseContent([page],plan).courseUnits!;expect(units).toHaveLength(1);expect(units[0]!.code).toBe('EDLD 751');
 });
});
