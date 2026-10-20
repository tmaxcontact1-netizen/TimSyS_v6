import JSZip from 'jszip';
import {load} from 'cheerio';
import {createHash,randomUUID} from 'node:crypto';
import {readMcfImport} from './mcf-import.js';
import {readJdPdf,type JdChunk,type PhysicalLine,type SourceSpan} from './jd-pdf-layout.js';

export const JD_RULES='jd-literal-structure.v3';
export type DocumentaryKind='heading'|'statement'|'descriptor'|'metadata'|'qualification'|'approval';
export type Passage={id:string;text:string;start:number;end:number;location:string;kind:DocumentaryKind;dimension:string;sourceSpans?:SourceSpan[];ambiguity?:string};
export type JdDocument={id:string;filename:string;sha256:string;extracted:string;role:string;warnings:string[];passages:Passage[];rawExtracted?:string;physicalLines?:PhysicalLine[];extractionRules?:string};
const heading=/^(?:Standard\s+\d+\s*:|Domain\s+\d+\s*:|(?:\d+\s*[.)]\s*)?(?:Responsibility of Support|For the student|For the parent|Student Management|Personnel Management|Instructional and Program Management|Professional Development|Key Responsibilities(?: and Primary Duties)?|General Expectations|Specific Responsibilities|In Class Assistance|Clerical\/Technical Assistance and General Duties|Scope of Authority|Confidentiality and Safeguarding Boundaries|AEA and Student Support Coordination|Records, Documentation, and Data Protection|Referral Pathway|Expected Outcomes|Professional Ethics and Boundaries|Section-Level Programme Delivery|Qualifications(?: and Requirements)?|Appointment and Performance Review|Appointment and Reappointment|Performance Review|Selection and Appointment Process|Approved (?:and Acknowledged|By)|Acknowledged By|Job Summary|Job Scope|Position Overview|Appendix:.*))$/i;
const field=/^(Job Title|Position Title|Reporting To|Works Closely With|Professional Guidance|Department|Applicable Sections|Appraised By|Evaluated By|Document Status|Appraisal Cycle|Framework Reference|Appointment Term)$/i;
export function isHeading(text:string){const t=text.replace(/\s+/g,' ').replace(/^\d+\s*\.\s*/,'').replace(/:$/,'').trim();return /^(Standard|Domain)\s+\d+\s*:/i.test(t)||heading.test(t)||/^Career Guidance \(.+\)$/.test(t);}
const administrative=/^(Qualifications|Appointment|Performance Review|Selection and Appointment|Approved|Acknowledged|Appendix|Position Overview)/i;

export async function extractJd(bytes:Buffer,filename:string):Promise<JdDocument>{
 const warnings:string[]=[];const chunks:JdChunk[]=[];let rawExtracted:string|undefined,physicalLines:PhysicalLine[]|undefined;
 if(/\.docx$/i.test(filename)){
  const zip=await JSZip.loadAsync(bytes);checkZip(zip);const part=zip.file('word/document.xml');if(!part)throw Error('Invalid DOCX');
  const $=load(await part.async('string'),{xml:true});
  $('w\\:body w\\:p').each((i,p)=>{
   const text=$(p).find('w\\:t,w\\:tab,w\\:br').map((_,n)=>n.tagName==='w:t'?$(n).text():n.tagName==='w:tab'?'\t':'\n').get().join('');
   if(!text.trim())return;const style=$(p).find('w\\:pStyle').attr('w:val')??'';
   chunks.push({text,location:`DOCX paragraph ${i+1}`,heading:/^Heading[1-6]$/i.test(style),bullet:$(p).find('w\\:numPr').length>0});
  });
 }else if(/\.pdf$/i.test(filename)){
  const pdf=await readJdPdf(bytes,isHeading);chunks.push(...pdf.chunks);rawExtracted=pdf.rawExtracted;physicalLines=pdf.physicalLines;
  warnings.push('PDF units reconstructed from physical line geometry, bullet markers and headings. Original line text and coordinates are retained; no OCR or text repair is applied.');
 }else if(/\.txt$/i.test(filename)){
  const raw=await readMcfImport(bytes,filename);warnings.push(...raw.warnings);
  // Text-layer whitespace is retained. Bullet and line boundaries are candidates, never silently corrected.
  const pages=raw.blocks.length?raw.blocks.map(b=>({text:raw.text.slice(b.start,b.end),page:Number(b.location.page)})):[{text:raw.text,page:0}];
  for(const page of pages){
   const lines=page.text.split(/(?=[•●])|\r?\n/);let carry='';
   const flush=()=>{if(carry.trim())chunks.push({text:carry,location:page.page?`PDF page ${page.page}`:'Text document',heading:false});carry='';};
   for(const line of lines){
    const clean=line.trim();
    if(!clean){flush();continue;}
    if(/^[•●]/.test(clean)){flush();carry=line;continue;}
    if(isHeading(clean)||field.test(clean)||/^(?:PAGE \d+|For internal use only|Bahrain Bayan School \||\d+\s*\/\s*\d+|\d+)$/i.test(clean)||/^(For internal use only|Bahrain Bayan School \|)/i.test(clean)){flush();chunks.push({text:line,location:page.page?`PDF page ${page.page}`:'Text document',heading:isHeading(clean)});continue;}
    if(carry&&/^[•●]/.test(carry.trim()))carry+='\n'+line;
    else {flush();carry=line;flush();}
   }flush();
  }
  if(/\.pdf$/i.test(filename))warnings.push('PDF reading order and wrapped bullets require checking against the original; no OCR or text repair is applied.');
 }else throw Error('Use DOCX, text-layer PDF, TXT or a ZIP containing these formats.');
 const passages:Passage[]=[];let extracted='',dimension='Unassigned — check source',role='',pendingRole=false,section:DocumentaryKind='metadata';
 for(let index=0;index<chunks.length;index++){
  const c=chunks[index]!,text=c.text,clean=text.trim(),start=extracted.length;extracted+=text+'\n\n';
  const inlineRole=/^(?:Job Title|Position Title)\s+(.+)$/i.exec(clean);
  if(inlineRole&&!role)role=inlineRole[1]!.trim();
  if(pendingRole&&!role){if(!field.test(clean)&&!isHeading(clean))role=clean;pendingRole=false;}
  if(/^(Job Title|Position Title)$/i.test(clean))pendingRole=true;
  const h=c.heading||isHeading(clean),normal=clean.replace(/^\d+\s*[.)]\s*/,'');
  if(h){dimension=clean;section=/^Qualifications?/i.test(normal)?'qualification':/^(Approved|Acknowledged|Signatures?)/i.test(normal)?'approval':administrative.test(normal)||/^Section-Level Programme Delivery$/i.test(normal)?'metadata':/^(Job Summary|Job Scope)$/i.test(normal)?'descriptor':'statement';}
  if(c.sectionBreak){dimension='Unassigned — heading not extracted';section=/^[•●▪◦]?\s*(?:BA\/BS|B[AS]c?|Master[’']?s|Bachelor[’']?s|Minimum of)\b/i.test(clean)?'qualification':'metadata';warnings.push(`${c.location}: ${c.ambiguous}`);}
  const nextHeading=chunks.findIndex((x,i)=>i>index&&(x.heading||isHeading(x.text)));
  const following=chunks.slice(index+1,nextHeading<0?undefined:nextHeading);
  const hasBullets=following.some(x=>x.bullet||/^[•●▪◦]/.test(x.text.trim()));
  const furniture=/^(For internal use only|Bahrain Bayan School\s*\||\d+\s*\/\s*\d+$|\d+$)/i.test(clean);
  const isField=field.test(clean)||/^(Job Title|Position Title|Reporting To|Works Closely With|Professional Guidance|Department|Applicable Sections|Appraised By|Evaluated By|Document Status|Appraisal Cycle|Framework Reference|Appointment Term)\s+/i.test(clean);
  let kind:DocumentaryKind=h?'heading':furniture||isField?'metadata':section;
  if(!h&&!isField&&!furniture&&!c.bullet&&!/^[•●▪◦]/.test(clean)&&section==='statement'&&hasBullets)kind='descriptor';
  if(!h&&section==='metadata'&&dimension==='Unassigned — check source'&&clean.length>150)kind='descriptor';
  // Document-organisation subjects are not role actions.
  if(!h&&!isField&&section==='statement'&&/^(?:the\s+)?(?:(?:\d+|[a-z-]+)\s+)?(?:standards|domains|sections)\s+(?:below|that follow|listed below)\s+(?:define|describe|set out|outline)\b/i.test(clean)&&following.length===0&&nextHeading>=0)kind='descriptor';
  if(!h&&!c.bullet&&(c.sourceSpans?.[0]?.x??0)>180&&section==='qualification'&&chunks[index+1]?.text.match(/^(Approved|Acknowledged)\b/i))kind='approval';
  const ambiguity=c.ambiguous??(c.sourceSpans&&/^Section-Level Programme Delivery$/i.test(dimension)&&!h?'Table cell associations are unresolved; retained as metadata, not individual responsibilities.':undefined);
  if(ambiguity&&!c.ambiguous&&!warnings.some(w=>w.includes(ambiguity)))warnings.push(`${c.location}: ${ambiguity}`);
  passages.push({id:randomUUID(),text,start,end:start+text.length,location:c.location,kind,dimension,...(c.sourceSpans?{sourceSpans:c.sourceSpans}:{}),...(ambiguity?{ambiguity}:{})});
 }
 if(!role)warnings.push('Role title was not identified reliably. Confirm it from the original JD.');
 if(passages.some(p=>/[\uFFFD\u0000]/.test(p.text)))warnings.push('Possible text corruption detected; retained without repair.');
 return{id:randomUUID(),filename,sha256:createHash('sha256').update(bytes).digest('hex'),extracted,role,warnings,passages,...(rawExtracted!==undefined?{rawExtracted,physicalLines:physicalLines!}:{}),extractionRules:JD_RULES};
}
function checkZip(zip:JSZip){
 const entries=Object.values(zip.files);if(entries.length>2000)throw Error('Too many archive entries');
 let total=0;for(const e of entries){total+=Number((e as any)._data?.uncompressedSize??0);if(total>80_000_000)throw Error('Archive exceeds 80 MB expanded limit');}
}
export async function unpackJds(bytes:Buffer,filename:string){
 if(!/\.zip$/i.test(filename))return[{filename,bytes}];
 const zip=await JSZip.loadAsync(bytes);checkZip(zip);const files=[];
 for(const entry of Object.values(zip.files)){
  if(entry.dir)continue;
  if(!/\.(docx|pdf|txt)$/i.test(entry.name))throw Error(`Unsupported file in ZIP: ${entry.name}. Upload only DOCX, PDF or TXT files.`);
  if(files.length>=50)throw Error('Upload at most 50 documents at a time');
  files.push({filename:entry.name.split('/').at(-1)!,bytes:Buffer.from(await entry.async('uint8array'))});
 }if(!files.length)throw Error('No documents in ZIP');return files;
}
