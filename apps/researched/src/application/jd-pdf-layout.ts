import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PhysicalLine={id:string;text:string;start:number;end:number;page:number;x:number;y:number;width:number;height:number;font:string;itemIndexes:number[]};
export type SourceSpan={lineId:string;start:number;end:number;page:number;x:number;y:number;width:number;height:number};
export type JdChunk={text:string;location:string;heading:boolean;bullet?:boolean;sectionBreak?:boolean;ambiguous?:string;sourceSpans?:SourceSpan[]};
const bullet=/^(?:[•●▪◦]|\d+[.)])\s*/;
const footer=/^(?:For internal use only|Bahrain Bayan School\s*\||\d+\s*\/\s*\d+$|\d+$)/i;
const field=/^(Job Title|Position Title|Reporting To|Works Closely With|Professional Guidance|Department|Applicable Sections|Appraised By|Evaluated By|Document Status|Appraisal Cycle|Framework Reference|Appointment Term)(?:\s|$)/i;
const approval=/^(Approved(?:\s+and\s+Acknowledged|\s+By)|Acknowledged By)(?:\s|$)/i;

// Physical lines are an auditable intermediate, never the default responsibility unit.
export async function readJdPdf(bytes:Buffer,isHeading:(text:string)=>boolean){
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),doc=await task.promise;
 const lines:PhysicalLine[]=[];let rawExtracted='';
 try{for(let page=1;page<=doc.numPages;page++){
  const p=await doc.getPage(page),c=await p.getTextContent();
  const groups:{y:number;items:{text:string;x:number;y:number;width:number;height:number;font:string;index:number}[]}[]=[];
  c.items.forEach((item,index)=>{if(!('str'in item)||!item.str.trim())return;const y=item.transform[5]!,x=item.transform[4]!;let row=groups.find(g=>Math.abs(g.y-y)<1.8);if(!row){row={y,items:[]};groups.push(row);}row.items.push({text:item.str,x,y,width:item.width,height:item.height,font:item.fontName,index});});
  for(const row of groups.sort((a,b)=>b.y-a.y)){
   const items=row.items.sort((a,b)=>a.x-b.x),first=items[0]!;
   let text='';for(let i=0;i<items.length;i++){const it=items[i]!,prev=items[i-1];const gap=prev?it.x-(prev.x+prev.width):0;text+=(i&&gap>Math.max(1,it.height*.12)&&!text.endsWith(' ')?' ':'')+it.text;}
   const start=rawExtracted.length;rawExtracted+=text+'\n';
   lines.push({id:`page-${page}-line-${lines.filter(x=>x.page===page).length+1}`,text,start,end:start+text.length,page,x:first.x,y:row.y,width:Math.max(...items.map(i=>i.x+i.width))-first.x,height:Math.max(...items.map(i=>i.height)),font:items.filter(i=>i.text.trim().length>1).map(i=>i.font).join('|'),itemIndexes:items.map(i=>i.index)});
  }p.cleanup();
 }}finally{await task.destroy();}
 return{rawExtracted,physicalLines:lines,chunks:reconstructJdLines(lines,isHeading)};
}
export function reconstructJdLines(lines:PhysicalLine[],isHeading:(text:string)=>boolean):JdChunk[]{
 const chunks:JdChunk[]=[];let buffer:PhysicalLine[]=[];let bufferExtra:Partial<JdChunk>={},approvalSection=false;
 const headingFonts=new Set(lines.filter(l=>isHeading(l.text.trim())&&!field.test(l.text.trim())).map(l=>l.font.split('|')[0]));
 const looksHeading=(l:PhysicalLine)=>isHeading(l.text)||(!bullet.test(l.text.trim())&&!field.test(l.text.trim())&&!footer.test(l.text.trim())&&headingFonts.has(l.font.split('|')[0])&&l.font.split('|').every(f=>f===l.font.split('|')[0])&&l.text.length<145&&!/[.!?;,]$/.test(l.text.trim())&&l.x<120);
 const push=(group:PhysicalLine[],extra:Partial<JdChunk>={})=>{if(!group.length)return;chunks.push({text:group.map(l=>l.text.trim()).join(' '),location:[...new Set(group.map(l=>`PDF page ${l.page}`))].join(', '),heading:false,bullet:bullet.test(group[0]!.text.trim()),sourceSpans:group.map(l=>({lineId:l.id,start:l.start,end:l.end,page:l.page,x:l.x,y:l.y,width:l.width,height:l.height})),...extra});};
 const flush=()=>{push(buffer,bufferExtra);buffer=[];bufferExtra={};};
 for(let i=0;i<lines.length;i++){
  const l=lines[i]!,t=l.text.trim(),prev=buffer.at(-1),first=buffer[0];
  if(footer.test(t)){// Keep page furniture out of cross-page continuation text.
   push([l]);continue;
  }
  if(approval.test(t)){flush();approvalSection=true;push([l],{heading:true});continue;}
  if(isHeading(t)||(!approvalSection&&looksHeading(l))){flush();approvalSection=false;push([l],{heading:true});continue;}
  if(field.test(t)){flush();buffer=[l];continue;}
  if(bullet.test(t)){
   const prior=lines[i-1],gap=prior&&prior.page===l.page?prior.y-l.y:0;
   flush();buffer=[l];
   if(prior&&gap>l.height*3&&Math.abs(prior.x-l.x)>4&&!looksHeading(prior)&&!field.test(prior.text)&&!footer.test(prior.text)){
    // A detached list without an extracted heading cannot inherit the previous dimension.
    bufferExtra={sectionBreak:true,ambiguous:'Detached list: section heading is absent from the text layer; confirm against the original.'};
   }continue;
  }
  if(!prev||!first){buffer=[l];continue;}
  const samePage=prev.page===l.page,gap=prev.y-l.y,sameIndent=Math.abs(l.x-first.x)<3;
  const hanging=bullet.test(first.text.trim())&&l.x>first.x+3&&l.x<first.x+45;
  const fieldContinuation=field.test(first.text.trim())&&l.x>first.x+25;
  const close=samePage&&gap>0&&gap<=Math.max(prev.height,l.height)*1.48;
  const unfinishedBullet=samePage&&hanging&&/\b(?:and|or)\s*$/i.test(prev.text)&&/^[a-z]/.test(t)&&prev.font===l.font&&gap>0&&gap<=Math.max(prev.height,l.height)*1.85;
  const crossPage= !samePage&& !/[.!?:]$/.test(prev.text.trim())&&(hanging||sameIndent)&&Math.abs(prev.height-l.height)<1;
  if((close&&(sameIndent||hanging||fieldContinuation))||unfinishedBullet||crossPage){buffer.push(l);continue;}
  flush();buffer=[l];
 }
 flush();
 // Furniture encountered during a continuation may have been emitted first; retain source order.
 return chunks.sort((a,b)=>(a.sourceSpans?.[0]?.start??0)-(b.sourceSpans?.[0]?.start??0));
}
