import {describe,it,expect} from "vitest";
import {createRequire} from "node:module";
import {readDocumentLinks,readContentPage,analyseContent,rankSupportingLinks} from "../src/application/content-reader.js";
import {contentPlanInput,failureObservation} from "../src/domain/content-analysis.js";
import {contentCsv} from "../src/entrypoints/content-api.js";
const require=createRequire(import.meta.url),JSZip=require("jszip");
const meta={id:"page",requestedUrl:"https://example.edu/med",hash:"hash",capturedAt:"2026-09-30T00:00:00Z",depth:0,parentUrl:null,reason:"test"};
async function docx(xml:string){const z=new JSZip();z.file("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');z.file("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');z.file("word/document.xml",`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${xml}</w:body></w:document>`);z.file("word/_rels/document.xml.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.edu/programme" TargetMode="External"/></Relationships>');return z.generateAsync({type:"nodebuffer"});}
describe("structured content analysis",()=>{
 it("reads embedded links, all sections and repeated programme contexts without a special heading",async()=>{
  const bytes=await docx('<w:p><w:r><w:t>Accreditation https://example.org/standards</w:t></w:r></w:p><w:p><w:r><w:t>Masters</w:t></w:r></w:p><w:p><w:hyperlink r:id="rId2"><w:r><w:t>Programme overview</w:t></w:r></w:hyperlink></w:p><w:p><w:r><w:t>Doctorate https://example.edu/programme</w:t></w:r></w:p><w:p><w:r><w:t>Training https://training.org/course</w:t></w:r></w:p>');
  const result=await readDocumentLinks(bytes,"application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  expect(result.links).toHaveLength(3);expect(result.links.find(l=>l.url.includes("programme"))?.occurrences).toHaveLength(2);
 });
 it("keeps module structure and locators without inferring credits or delivery from unrelated text",async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>Educational Leadership MEd</h1><p>Contact us in Boston, MA. Apply online using our application portal. Credit card payments are accepted. Founded three years ago.</p><h2>Curriculum</h2><ul><li>EDU 501 — Governance: accountability and ethical decision making.</li><li>EDU 502 — School improvement: practical change projects.</li></ul><h2>Assessment</h2><p>A portfolio and supervised dissertation are required.</p></main>'),"text/html","https://example.edu/med",meta);
  const result=analyseContent([page],contentPlanInput.parse({}));
  expect(result.fields.curriculum).toHaveLength(2);expect(result.fields.assessment?.[0]?.text).toContain("portfolio");expect(result.fields.delivery).toEqual([]);expect(result.fields.duration).toEqual([]);expect(result).not.toHaveProperty("confidence");
  expect(analyseContent([page],contentPlanInput.parse({}))).toEqual(result);
 });
 it("retains accreditation sources separately and never gives empty evidence a percentage",async()=>{
  const page=await readContentPage(Buffer.from('<main><h1>School accreditation standards</h1><h2>Curriculum</h2><p>Schools must provide a curriculum.</p></main>'),"text/html","https://example.org/accreditation",meta);
  const result=analyseContent([page],contentPlanInput.parse({}));expect(result.kind).toBe("accreditation");expect(result.fields.curriculum).toEqual([]);expect(analyseContent([],contentPlanInput.parse({})).coverage.found).toBe(0);
 });
 it("ranks supporting curriculum files but does not silently trust another host",()=>{
  const links=rankSupportingLinks('<a href="/curriculum">Curriculum</a><a href="https://docs.example.edu/handbook.pdf">Programme handbook</a><a href="https://evil.edu/courses">Courses and curriculum</a><a href="/login">Curriculum login</a>',"https://example.edu/programme","https://example.edu/programme",contentPlanInput.parse({}));
  expect(links.find(l=>l.url.includes("handbook"))?.allowed).toBe(true);expect(links.find(l=>l.url.includes("evil"))?.allowed).toBe(false);expect(links.some(l=>l.url.includes("login"))).toBe(false);
 });
 it("distinguishes missing, restricted and temporary failures",()=>{expect(failureObservation(Object.assign(Error("http"),{status:404}),"url",null).status).toBe("missing");expect(failureObservation(Object.assign(Error("http"),{status:403}),"url",null).status).toBe("blocked");expect(failureObservation(Object.assign(Error("http"),{status:503}),"url",null).status).toBe("temporary_failure");});
 it("escapes CSV formulas and retains failed sources",()=>{const output=contentCsv({tasks:[{url:"=HYPERLINK(1)",status:"failed",error:{status:"missing"}}]});expect(output).toContain("'=HYPERLINK");expect(output).toContain("missing");});
});
