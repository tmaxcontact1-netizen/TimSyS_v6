import mammoth from 'mammoth';
import JSZip from 'jszip';
import {load} from 'cheerio';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {posix} from 'node:path';
import type {z} from 'zod';
import type {mappingInput} from '../domain/mcf.js';

export const MCF_EXTRACTOR='researched.mcf.raw-import.v1';
export interface Sheet { name:string; rows:{row:number; cells:string[]; formulas:Record<string,string>}[] }
export interface RawImport { format:string; text:string; sheets:Sheet[]; warnings:string[]; blocks:{start:number;end:number;location:Record<string,unknown>}[] }
export function decodeText(bytes:Buffer){
 if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(bytes);
 if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be',{fatal:true}).decode(bytes);
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function csvRows(text:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const ch=text[i]!;
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'&&!cell&&!closed){quoted=true;continue;}
  if(ch===','){row.push(cell);cell='';closed=false;continue;}
  if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';closed=false;continue;}
  if(closed)throw Error('invalid_csv_after_quoted_field');
  if(ch==='"')throw Error('invalid_csv_quote');cell+=ch;
 }
 if(quoted)throw Error('unterminated_csv_quote');if(cell||row.length||closed){row.push(cell);rows.push(row);}return rows;
}
async function xlsx(bytes:Buffer):Promise<Sheet[]>{
 const zip=await JSZip.loadAsync(bytes);let total=0;
 for(const file of Object.values(zip.files)){total+=Number((file as any)._data?.uncompressedSize??0);if(total>100_000_000)throw Error('workbook_uncompressed_limit');}
 const read=async(name:string)=>{const file=zip.file(name);if(!file)throw Error('invalid_workbook_part');const xml=await file.async('string');if(xml.length>50_000_000)throw Error('workbook_part_limit');return load(xml,{xml:true});};
 const wb=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels');const strings:string[]=[];
 if(zip.file('xl/sharedStrings.xml')){const shared=await read('xl/sharedStrings.xml');shared('si').each((_,el)=>{strings.push(shared(el).find('t').map((__,t)=>shared(t).text()).get().join(''));});}
 const sheets:Sheet[]=[];let cellCount=0;
 for(const element of wb('sheet').toArray()){
  const id=wb(element).attr('r:id'),relation=rels('Relationship').toArray().find(el=>rels(el).attr('Id')===id);
  if(!relation||rels(relation).attr('TargetMode')==='External')throw Error('external_workbook_sheet_not_supported');
  const target=rels(relation).attr('Target')??'',path=target.startsWith('/')?target.slice(1):posix.normalize('xl/'+target);if(!path.startsWith('xl/'))throw Error('invalid_workbook_path');
  const xml=await read(path),rows:Sheet['rows']=[];
  for(const element of xml('sheetData > row').toArray()){
   const cells:string[]=[],formulas:Record<string,string>={};
   for(const cell of xml(element).find('c').toArray()){
    if(++cellCount>500000)throw Error('workbook_cell_limit');const ref=xml(cell).attr('r')??'';let col=0;for(const letter of ref.replace(/\d/g,''))col=col*26+letter.charCodeAt(0)-64;
    if(col<1||col>1001)throw Error('workbook_column_limit');const type=xml(cell).attr('t'),v=xml(cell).find('v').text();
    cells[col-1]=type==='s'?strings[Number(v)]??'':type==='inlineStr'?xml(cell).find('is t').map((_,t)=>xml(t).text()).get().join(''):v;
    const f=xml(cell).find('f');if(f.length)formulas[String(col-1)]=f.text();
   }
   rows.push({row:Number(xml(element).attr('r')??rows.length+1),cells:Array.from(cells,v=>v??''),formulas});
  }
  sheets.push({name:wb(element).attr('name')??`Sheet ${sheets.length+1}`,rows});
 }
 return sheets;
}
export async function readMcfImport(bytes:Buffer,filename:string):Promise<RawImport>{
 const format=filename.split('.').at(-1)?.toLowerCase()??'';const result:RawImport={format,text:'',sheets:[],warnings:[],blocks:[]};
 if(format==='xlsx'){result.sheets=await xlsx(bytes);result.warnings.push('Spreadsheet values are preserved as stored, without evaluating formulas or formatting dates. Mapped formula cells are rejected; supply raw values.');}
 else if(format==='csv'){result.text=decodeText(bytes);result.sheets=[{name:'CSV',rows:csvRows(result.text).map((cells,i)=>({row:i+1,cells,formulas:{}}))}];}
 else if(format==='txt')result.text=decodeText(bytes);
 else if(format==='docx'){const raw=await mammoth.extractRawText({buffer:bytes});result.text=raw.value;result.warnings=raw.messages.map(m=>m.message);result.warnings.push('DOCX text is the unchanged parser output; verify paragraph order against the preserved original.');}
 else if(format==='pdf'){
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const doc=await task.promise;
  try{for(let page=1;page<=doc.numPages;page++){const p=await doc.getPage(page),content=await p.getTextContent();const text=content.items.map(i=>'str'in i?i.str+(i.hasEOL?'\n':' '):'').join('');const start=result.text.length;result.text+=text;result.blocks.push({start,end:result.text.length,location:{page}});if(page<doc.numPages)result.text+='\n\n';p.cleanup();}}finally{await task.destroy();}
  if(!result.text.trim())result.warnings.push('No text layer. Original PDF preserved; supply a verified transcription before coding. OCR is not silently substituted.');
 }else if(format==='html'||format==='htm'){const $=load(decodeText(bytes));$('script,style,noscript').remove();$('h1,h2,h3,h4,h5,h6,p,li,tr').each((_,el)=>{if($(el).parents('p,li,tr').length)return;const text=$(el).text(),start=result.text.length;result.text+=text;result.blocks.push({start,end:result.text.length,location:{element:el.tagName,ordinal:result.blocks.length+1}});result.text+='\n\n';});result.warnings.push('HTML extraction is derived visible text; original markup is preserved.');}
 else throw Error('unsupported_import_format');
 if(result.text.length>5_000_000||result.sheets.reduce((n,s)=>n+s.rows.length,0)>25000)throw Error('import_record_limit');
 return result;
}
export function mapMcfRecords(raw:RawImport,m:z.infer<typeof mappingInput>,category:string){
 const out:{text:string;institution:string;reviewIdentifier:string;reviewCategory:string;locator:Record<string,unknown>}[]=[];
 if(raw.sheets.length){
  const sheet=raw.sheets.find(s=>s.name===m.sheet);if(!sheet)throw Error('select_sheet');if(m.textColumn===null)throw Error('select_text_column');
  for(const row of sheet.rows.filter(r=>r.row>m.headerRow)){
   for(const c of [m.textColumn,m.institutionColumn,m.identifierColumn,m.categoryColumn])if(c!==null&&String(c) in row.formulas)throw Error('mapped_formula_cell_requires_raw_value');
   const text=row.cells[m.textColumn]??'';if(!text.trim())continue;
   const cat=m.categoryColumn===null?category:row.cells[m.categoryColumn]??'';if(cat!==category)throw Error('review_category_must_match_dataset');
   out.push({text,institution:m.institutionColumn===null?m.institution:row.cells[m.institutionColumn]??'',reviewIdentifier:m.identifierColumn===null?(m.reviewIdentifier?m.reviewIdentifier+':'+row.row:'row:'+row.row):row.cells[m.identifierColumn]??'',reviewCategory:cat,locator:{sheet:sheet.name,row:row.row,column:m.textColumn+1}});
  }
 }else{
  const spans=m.recordMode==='paragraphs'?[...raw.text.matchAll(/[^\r\n](?:[^\r\n]|(?:\r?\n)(?!\r?\n))*/g)].map(x=>({start:x.index,end:x.index+x[0].length})):[{start:0,end:raw.text.length}];
  for(const [i,s] of spans.entries())out.push({text:raw.text.slice(s.start,s.end),institution:m.institution,reviewIdentifier:m.reviewIdentifier+(spans.length>1?':'+(i+1):'')||'document',reviewCategory:category,locator:{originalStart:s.start,originalEnd:s.end,record:i+1,blocks:raw.blocks.filter(b=>b.end>s.start&&b.start<s.end)}});
 }
 if(!out.length)throw Error('no_records_mapped');if(out.some(r=>r.text.includes('\0')))throw Error('text_contains_null_character');return out;
}
