import {it,expect} from 'vitest';
import JSZip from 'jszip';
import {inspectCompiledDocx,mapCompiledRecords,structuralMappingInput} from '../src/application/compiled-review.js';
import {PRINCIPAL_ITEMS,PRINCIPAL_CATEGORIES} from '../src/application/principal-review.js';
import {snapshotIsrRatings,isrMetadataForRequest} from '../src/domain/isr-rating-metadata.js';
import {initialSpans} from '../src/domain/mcf.js';
import {reconcileReviewBreaks} from '../../../../apps/researched/frontend/src/workbench/review-navigation.js';
const p=(s:string)=>`<w:p><w:r><w:t>${s.replaceAll('&','&amp;')}</w:t></w:r></w:p>`;
const tc=(s:string)=>`<w:tc>${s}</w:tc>`;
export function principalFixture(extra=false,change:(s:string)=>string=s=>s){return '<w:tbl><w:tr>'+(extra?tc(p('\u00a0')):'')+PRINCIPAL_CATEGORIES.map(x=>tc(p(x))).join('')+'</w:tr>'+PRINCIPAL_ITEMS.map(([,label],i)=>'<w:tr>'+tc(p(label))+tc('<w:tbl><w:tr>'+[0,1,2,3].map(j=>tc(change(j===([1,5,7].includes(i)?2:3)?'<w:p><w:pPr/></w:p>':p('\u00a0')))).join('')+'</w:tr></w:tbl>')+'</w:tr>').join('')+'</w:tbl>'+p('Management style')+p('The team received useful coaching.');}
async function doc(body:string){const zip=new JSZip();zip.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);return inspectCompiledDocx(await zip.generateAsync({type:'nodebuffer'}));}
function mapping(d:any){return structuralMappingInput.parse({profile:d.profile.id+'@'+d.profile.version,hash:d.hash,previousMappingId:null,reason:'Test',documentComponents:['narrative'],records:d.candidates.map((c:any)=>({start:c.start,end:c.end,confirmed:true,institution:{state:'unassigned',name:''},include:['narrative']}))});}
it('calibrates all nine structural selections, retains raw XML and defaults to narrative only',async()=>{
 const d=await doc(principalFixture()),r=mapCompiledRecords(d,mapping(d),'');
 expect((d as any).principalSummary).toMatchObject({reviews:1,recovered:9,unresolved:0});
 expect(r[0]!.locator.respondentRatings.ratings.map((x:any)=>x.value)).toEqual(['Poor','Average','Poor','Poor','Poor','Average','Poor','Average','Poor']);
 expect(r[0]!.text).toBe('The team received useful coaching.');expect(r[0]!.locator.respondentRatings.ratings[0].candidates[0].codepoints).toEqual(['U+00a0']);
 expect(reconcileReviewBreaks(undefined,d)[0]!.include).toEqual(['narrative']);
});
it('accepts an extra leading header without shifting columns',async()=>{const d=await doc(principalFixture(true));expect((d as any).principalSummary.recovered).toBe(9);expect(mapCompiledRecords(d,mapping(d),'')[0]!.locator.respondentRatings.ratings[0].value).toBe('Poor');});
it.each(['space','all_empty','all_marked','object'])('leaves malformed %s selections unresolved',async(kind)=>{
 const d=await doc(principalFixture(false,s=>kind==='space'?s.replace('\u00a0',' '):kind==='all_empty'?'<w:p/>':kind==='all_marked'?p('\u00a0'):s.replace('</w:p>','<w:object/></w:p>')));
 expect((d as any).principalSummary.unresolved).toBe(9);expect(d.candidates[0]!.warnings).toContain('unresolved_structured_ratings');
});
it('flags duplicate and missing prompts rather than guessing',async()=>{const d=await doc(principalFixture().replace('Good listener, easily approachable','Fair &amp; equitable with all staff'));expect((d as any).principalSummary.unresolved).toBe(2);});
it('rejects ratings, headings and editorial inclusion and cross-review joins',async()=>{
 const d=await doc(principalFixture()+principalFixture()),m=mapping(d);m.records.forEach(r=>r.include=['questionnaire']);m.documentComponents=['questionnaire'];expect(()=>mapCompiledRecords(d,m,'')).toThrow('narrative-only');
 const joined=mapping(d);joined.records=[{...joined.records[0]!,end:joined.records[1]!.end}];expect(()=>mapCompiledRecords(d,joined,'')).toThrow('boundaries must remain separate');
});
it('preserves other profiles as separate excluded records and never applies the Director scale to Principal units',async()=>{
 const other='<w:tbl><w:tr>'+tc(p('Characteristics:'))+'</w:tr><w:tr>'+tc(p('Fair'))+tc(p('1'))+'</w:tr></w:tbl>'+p('Additional Comments')+p('Other profile narrative.');
 const d=await doc(principalFixture()+other+principalFixture()),r=mapCompiledRecords(d,mapping(d),'');expect(r).toHaveLength(3);expect(r[1]!.locator.excludeFromAnalysis).toBe(true);expect(r[0]!.text).not.toContain('Other profile');expect(r[2]!.text).not.toContain('Other profile');
 const records=r.filter(x=>!x.locator.excludeFromAnalysis).map((x,i)=>({id:String(i),original_text:x.text,locator:x.locator}));
 const units=records.flatMap((x,i)=>initialSpans(x.original_text).map((s,j)=>({id:`${i}-${j}`,record_id:x.id,unit_set_id:String(i),start_offset:s.start,end_offset:s.end})));
 const snapshot=snapshotIsrRatings(records,units);expect(snapshot.ratings).toEqual([]);expect(isrMetadataForRequest({ambiguityProtocol:2,ambiguitySourceMetadata:snapshot},'0')).toEqual({metadata:null,instructions:''});
});

it('preserves Director-first ingestion when a later questionnaire is Principal',async()=>{
 const other='<w:tbl><w:tr>'+tc(p('Characteristics:'))+'</w:tr><w:tr>'+tc(p('Fair'))+tc(p('1'))+'</w:tr></w:tbl>'+p('Comments:')+p('Director narrative.');
 const d=await doc(other+principalFixture());expect(d.profile.id).not.toBe('principal-questionnaire');
});
