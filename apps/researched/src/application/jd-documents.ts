import JSZip from 'jszip';
import {load} from 'cheerio';
import {createHash,randomUUID} from 'node:crypto';
import {readMcfImport} from './mcf-import.js';

export const JD_RULES='jd-literal-structure.v1';
export type Passage={id:string;text:string;start:number;end:number;location:string;kind:'heading'|'statement'|'metadata';dimension:string};
export type JdDocument={id:string;filename:string;sha256:string;extracted:string;role:string;warnings:string[];passages:Passage[]};
const heading=/^(?:Standard\s+\d+\s*:|Domain\s+\d+\s*:|(?:\d+\s*[.)]\s*)?(?:Responsibility of Support|For the student|For the parent|Student Management|Personnel Management|Instructional and Program Management|Professional Development|Key Responsibilities(?: and Primary Duties)?|General Expectations|Specific Responsibilities|In Class Assistance|Clerical\/Technical Assistance and General Duties|Scope of Authority|Confidentiality and Safeguarding Boundaries|AEA and Student Support Coordination|Records, Documentation, and Data Protection|Referral Pathway|Expected Outcomes|Professional Ethics and Boundaries|Section-Level Programme Delivery|Qualifications(?: and Requirements)?|Appointment and Performance Review|Appointment and Reappointment|Performance Review|Selection and Appointment Process|Approved (?:and Acknowledged|By)|Acknowledged By|Job Summary|Job Scope|Position Overview|Appendix:.*))$/i;
const field=/^(Job Title|Position Title|Reporting To|Works Closely With|Professional Guidance|Department|Applicable Sections|Appraised By|Evaluated By|Document Status|Appraisal Cycle|Framework Reference|Appointment Term)$/i;
export function isHeading(text:string){const t=text.replace(/\s+/g,' ').replace(/^\d+\s*\.\s*/,'').replace(/:$/,'').trim();return /^(Standard|Domain)\s+\d+\s*:/i.test(t)||heading.test(t)||/^Career Guidance \(.+\)$/.test(t);}
const administrative=/^(Qualifications|Appointment|Performance Review|Selection and Appointment|Approved|Acknowledged|Appendix|Position Overview)/i;

export async function extractJd(bytes:Buffer,filename:string):Promise<JdDocument>{
 const warnings:string[]=[];const chunks:{text:string;location:string;heading:boolean}[]=[];
 if(/\.docx$/i.test(filename)){
  const zip=await JSZip.loadAsync(bytes);checkZip(zip);const part=zip.file('word/document.xml');if(!part)throw Error('Invalid DOCX');
  const $=load(await part.async('string'),{xml:true});
  $('w\\:body w\\:p').each((i,p)=>{
   const text=$(p).find('w\\:t,w\\:tab,w\\:br').map((_,n)=>n.tagName==='w:t'?$(n).text():n.tagName==='w:tab'?'\t':'\n').get().join('');
   if(!text.trim())return;const style=$(p).find('w\\:pStyle').attr('w:val')??'';
   chunks.push({text,location:`DOCX paragraph ${i+1}`,heading:/^Heading[1-6]$/i.test(style)});
  });
 }else if(/\.(pdf|txt)$/i.test(filename)){
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
 if(/\.pdf$/i.test(filename)&&chunks.some(c=>c.text.trim()==='Position Overview')){
  const fieldStart=/^(Job Title|Position Title|Reporting To|Works Closely With|Professional Guidance|Department|Applicable Sections|Appraised By|Evaluated By|Document Status|Appraisal Cycle|Framework Reference|Appointment Term)\s+/i;
  for(let i=0;i<chunks.length;i++){
   if(!fieldStart.test(chunks[i]!.text.trim()))continue;
   while(i+1<chunks.length){
    const next=chunks[i+1]!,t=next.text.trim();
    if(next.location!==chunks[i]!.location||fieldStart.test(t)||field.test(t)||isHeading(t)||/^[•●]|^(For internal use only|Bahrain Bayan School \|)/i.test(t))break;
    chunks[i]!.text+='\n'+next.text;chunks.splice(i+1,1);
   }
  }
 }
 const passages:Passage[]=[];let extracted='',dimension='Unassigned — check source',role='',pendingRole=false,metadata=true;
 for(const c of chunks){
  const text=c.text,clean=text.trim(),start=extracted.length;extracted+=text+'\n\n';
  const inlineRole=/^(?:Job Title|Position Title)\s+(.+)$/i.exec(clean);
  if(inlineRole&&!role)role=inlineRole[1]!.trim();
  if(pendingRole&&!role){role=clean;pendingRole=false;}
  if(/^(Job Title|Position Title)$/i.test(clean))pendingRole=true;
  const h=c.heading||isHeading(clean);
  if(h){dimension=clean;metadata=administrative.test(clean);}
  passages.push({id:randomUUID(),text,start,end:start+text.length,location:c.location,kind:h?'heading':field.test(clean)||metadata||/^(For internal use only|Bahrain Bayan School \||\d+\s*\/\s*\d+$|\d+$)/i.test(clean)?'metadata':'statement',dimension});
 }
 if(!role)warnings.push('Role title was not identified reliably. Confirm it from the original JD.');
 if(passages.some(p=>/[\uFFFD\u0000]/.test(p.text)))warnings.push('Possible text corruption detected; retained without repair.');
 return{id:randomUUID(),filename,sha256:createHash('sha256').update(bytes).digest('hex'),extracted,role,warnings,passages};
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
