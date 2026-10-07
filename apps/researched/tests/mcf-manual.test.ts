import {describe,it,expect} from 'vitest';
import JSZip from 'jszip';
import {datasetInput,MCF,MCF_HASH,initialSpans,editSpans,seededSample,decisionInput,representationInput,mappingInput,validateDecision} from '../src/domain/mcf.js';
import {csvRows,readMcfImport,mapMcfRecords} from '../src/application/mcf-import.js';

const actor='Researcher';
const boundaries=[
 'The building needs improvement.',
 'MAP results were used to determine intervention groups.',
 'The principal introduced a new appraisal system without consulting staff.',
 'The school has very diverse students.',
 'Staff from different nationalities receive different benefits for equivalent roles.',
 'The principal is a visionary leader.',
 'The leadership team established a three-year plan with measurable priorities and annual reviews.',
 'The principal is unethical.',
 "Management changed teachers' grades after parent complaints without informing the teachers.",
];
describe('frozen MCF instrument and manual-only boundaries',()=>{
 it('retains exactly seven domains and 21 named competencies with no classifier aids',()=>{expect(MCF.domains).toHaveLength(7);expect(MCF.competencies).toHaveLength(21);expect(MCF.competencies.find(c=>c.id==='C3')?.competency).toBe('Conflict and Performance Management');expect(MCF.competencies.every(c=>c.frameworkVersion==='1.0')).toBe(true);expect(MCF_HASH).toBe('0c10b62334e888084a0d293e8d2d0a08f634035f3b7212e1e791e57a011d5f24');expect(()=>{(MCF as any).version='2';}).toThrow();expect(JSON.stringify(MCF)).not.toMatch(/candidateTerms|synonyms|retrievalExpressions/);});
 it.each(boundaries)('never assigns any competency or sentiment on import: %s',async text=>{const raw=await readMcfImport(Buffer.from(text),'review.txt');const record=mapMcfRecords(raw,mappingInput.parse({actor}),'Principal')[0]!;expect(record.text).toBe(text);expect(record).not.toHaveProperty('codes');expect(record).not.toHaveProperty('sentiment');});
 it('supports multi-label human coding with exact evidence and rejects invented spans',()=>{const text=boundaries[2]!;const value=decisionInput.parse({previousId:null,codes:['B2','C3','F1'].map(competencyId=>({competencyId,evidenceStrength:'Implicit',valence:'negative',evidence:text,rationale:'Researcher contextual coding'})),valence:'negative',reviewedNoCode:false,notes:'',actor});expect(()=>validateDecision(value,text,'reviews')).not.toThrow();value.codes[0]!.evidence='invented evidence';expect(()=>validateDecision(value,text,'reviews')).toThrow('exact_unit_substring');});
 it('requires an explicit reviewed-no-code decision and rejects machine-only strength',()=>{const value={previousId:null,codes:[],valence:null,reviewedNoCode:false,notes:'',actor};expect(decisionInput.safeParse(value).success).toBe(false);expect(decisionInput.safeParse({...value,reviewedNoCode:true}).success).toBe(true);expect(decisionInput.safeParse({...value,codes:[{competencyId:'C3',evidenceStrength:'Insufficient',valence:null,evidence:'x',rationale:''}]}).success).toBe(false);});
 it('separates documentary absence, unavailable and unassessed; requires positive-score evidence',()=>{const value={previousId:null,competencyId:'A1',state:'assessed',score:0,evidenceUnitIds:[],notes:'',actor};expect(representationInput.safeParse(value).success).toBe(true);expect(representationInput.safeParse({...value,score:1}).success).toBe(false);expect(representationInput.safeParse({...value,state:'source-unavailable',score:0}).success).toBe(false);expect(representationInput.safeParse({...value,state:'source-unavailable',score:null}).success).toBe(true);expect(representationInput.safeParse({...value,state:'not-yet-assessed',score:null}).success).toBe(true);});
 it('does not permit valence in documentary coding',()=>{const v=decisionInput.parse({previousId:null,codes:[],valence:'positive',reviewedNoCode:true,notes:'',actor});expect(()=>validateDecision(v,'Text','documentary')).toThrow('no_valence');});
});
describe('lossless derived text and reproducible segmentation',()=>{
 it('retains unnormalised DOCX parser output and archive paragraph offsets',async()=>{
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">  First review.  </w:t></w:r></w:p><w:p><w:r><w:t>Second review.</w:t></w:r></w:p></w:body></w:document>');
  const raw=await readMcfImport(await zip.generateAsync({type:'nodebuffer'}),'pilot.docx');expect(raw.text).toBe('  First review.  \n\nSecond review.\n\n');const mapped=mapMcfRecords(raw,mappingInput.parse({actor,recordMode:'paragraphs'}),'Principal');expect(mapped).toHaveLength(2);for(const r of mapped)expect(raw.text.slice(r.locator.originalStart as number,r.locator.originalEnd as number)).toBe(r.text);
 });
 it('retains CRLF, spaces and Unicode; split/join reconstructs the exact original',async()=>{const text='  First 😀 sentence.\r\nSecond sentence.  ';const raw=await readMcfImport(Buffer.from(text),'text.txt');expect(raw.text).toBe(text);const spans=initialSpans(text);expect(spans.map(s=>text.slice(s.start,s.end)).join('')).toBe(text);const split=editSpans(text,spans,'split',1,10);expect(split.map(s=>text.slice(s.start,s.end)).join('')).toBe(text);expect(editSpans(text,split,'join',1)).toEqual(spans);expect(()=>editSpans('😀 x',[{start:0,end:4}],'split',1,1)).toThrow();});
 it('sampling is independent of population order and includes no duplicate IDs',()=>{const ids=Array.from({length:100},(_,i)=>String(i));expect(seededSample(ids,'seed',20)).toEqual(seededSample([...ids].reverse(),'seed',20));expect(seededSample(ids,'seed',20)).not.toEqual(seededSample(ids,'other',20));expect(new Set(seededSample([...ids,...ids],'seed',20)).size).toBe(20);});
 it('CSV handles quoted commas, multiline fields and double quotes without changing field content',async()=>{const text='id,review,school\r\n007,"Line 1, yes\r\nLine ""two""",School A\r\n';expect(csvRows(text)[1]?.[1]).toBe('Line 1, yes\r\nLine "two"');const raw=await readMcfImport(Buffer.from(text),'pilot.csv');expect(raw.text).toBe(text);const records=mapMcfRecords(raw,mappingInput.parse({actor,sheet:'CSV',textColumn:1,identifierColumn:0,institutionColumn:2}),'Director');expect(records[0]).toMatchObject({reviewIdentifier:'007',institution:'School A',locator:{sheet:'CSV',row:2,column:2},text:'Line 1, yes\r\nLine "two"'});});
 it('rejects malformed CSV and cross-corpus categories',async()=>{expect(()=>csvRows('"unclosed')).toThrow();const raw=await readMcfImport(Buffer.from('text,category\nReview,School'),'x.csv');expect(()=>mapMcfRecords(raw,mappingInput.parse({actor,sheet:'CSV',textColumn:0,categoryColumn:1}),'Director')).toThrow('category_must_match');});
 it('reads XLSX rich strings, sparse cells and locations, without using historical labels',async()=>{const zip=new JSZip();zip.file('xl/workbook.xml','<workbook xmlns:r="rels"><sheets><sheet name="Director" r:id="r1"/></sheets></workbook>');zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>');zip.file('xl/sharedStrings.xml','<sst><si><t>Review</t></si><si><r><t>  Raw </t></r><r><t>text.  </t></r></si></sst>');zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>old competency</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2" t="inlineStr"><is><t>Continuous Improvement</t></is></c></row></sheetData></worksheet>');const raw=await readMcfImport(await zip.generateAsync({type:'nodebuffer'}),'x.xlsx');const records=mapMcfRecords(raw,mappingInput.parse({actor,sheet:'Director',textColumn:0}),'Director');expect(records[0]?.text).toBe('  Raw text.  ');expect(records[0]).not.toHaveProperty('codes');expect(raw.sheets[0]?.rows[1]?.cells[2]).toBe('Continuous Improvement');});
 it('refuses mapped formula cells instead of executing or silently classifying them',()=>{const raw={format:'xlsx',text:'',warnings:[],blocks:[],sheets:[{name:'Sheet',rows:[{row:1,cells:['Text'],formulas:{}},{row:2,cells:['Computed'],formulas:{'0':'A1'}}]}]};expect(()=>mapMcfRecords(raw,mappingInput.parse({actor,sheet:'Sheet',textColumn:0}),'School')).toThrow('requires_raw_value');});
});

describe('general document intake',()=>{
 it('does not invent a school or review category for general sources',async()=>{
 const dataset=datasetInput.parse({title:'Operations notes',mode:'general',reviewCategory:'',actor});
 const raw=await readMcfImport(Buffer.from('The manager allocates resources.'),'operations.txt');
 const record=mapMcfRecords(raw,mappingInput.parse({actor}),dataset.reviewCategory)[0]!;
 expect(record.reviewCategory).toBe('');expect(record.institution).toBe('');
 expect(datasetInput.safeParse({...dataset,reviewCategory:'School'}).success).toBe(false);
 const decision=decisionInput.parse({previousId:null,codes:[],valence:'neutral-descriptive',reviewedNoCode:true,notes:'',actor});
 expect(()=>validateDecision(decision,record.text,'general')).not.toThrow();
 });
});
