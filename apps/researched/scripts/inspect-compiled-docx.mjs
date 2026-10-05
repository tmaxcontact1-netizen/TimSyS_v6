import {readMcfImport} from '../dist/src/application/mcf-import.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectCompiledDocx,mapCompiledRecords,structuralMappingInput} from '../dist/src/application/compiled-review.js';
import {initialSpans} from '../dist/src/domain/mcf.js';
if(!process.argv[2])throw Error('Usage: node scripts/inspect-compiled-docx.mjs source.docx [report.json]');
const bytes=await readFile(process.argv[2]),preview=await inspectCompiledDocx(bytes);
// In-memory derivation only: not researcher confirmation and never a database import.
const mapping=structuralMappingInput.parse({profile:`${preview.profile.id}@${preview.profile.version}`,hash:preview.hash,previousMappingId:null,reason:'Read-only parser verification; not a researcher decision',records:preview.candidates.map(c=>({start:c.start,end:c.end,confirmed:true,institution:{state:'unassigned',name:''},include:['narrative']}))});
const originalExtraction=await readMcfImport(bytes,'source.docx');
const records=mapCompiledRecords(preview,mapping,'School');
const componentCounts={};for(const b of preview.blocks)componentCounts[b.component]=(componentCounts[b.component]??0)+1;
const report={originalExtractedCharacters:originalExtraction.text.length,sourceSha256:createHash('sha256').update(bytes).digest('hex'),profile:`${preview.profile.id}@${preview.profile.version}`,structuralHash:preview.hash,candidates:preview.candidates.length,highConfidence:preview.candidates.filter(c=>c.confidence==='high').length,requiresReview:preview.candidates.filter(c=>c.confidence==='review-required').length,headed:preview.candidates.filter(c=>c.heading).length,unheaded:preview.candidates.filter(c=>!c.heading).length,institutions:{confirmed:0,proposed:0,unassigned:records.length},componentCounts,replacementCharacters:preview.blocks.reduce((n,b)=>n+[...b.text].filter(c=>c==='\uFFFD').length,0),reviewsWithReplacementCharacters:preview.candidates.filter(c=>c.warnings.includes('replacement_character')).length,warnings:preview.warnings,narrativeCharacters:records.reduce((n,r)=>n+r.text.length,0),sentenceUnits:records.reduce((n,r)=>n+initialSpans(r.text).length,0),excludedFromDefaultAnalysis:['questionnaire','heading','editorial','marker'],sourcePreserved:true,databaseWrites:false,researcherConfirmed:false};
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
