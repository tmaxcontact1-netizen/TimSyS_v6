import {CLASSIFICATION_RULES_V9} from '../src/domain/mcf-semantic-policy.js';
import {describe,it,expect} from 'vitest';
import {isrRating,snapshotIsrRatings,isrMetadataForRequest} from '../src/domain/isr-rating-metadata.js';
import {retainAiAmbiguity,aiAmbiguitySummary} from '../src/domain/ai-ambiguity.js';
import {competencyEvidenceCounts} from '../src/domain/mcf-evidence.js';
import {MCF,MCF_HASH} from '../src/domain/mcf.js';
import {SemanticWorker} from '../src/application/mcf-semantic.js';
const id='11111111-1111-4111-8111-111111111111';
function fixture(text:string){
 const unit={id,record_id:'review',unit_set_id:'set',original_text:text,start_offset:0,end_offset:text.length};
 const record={id:'review',original_text:text,locator:{profile:'director-questionnaire@1.1',components:[{index:0,component:'questionnaire'}],analysisSpans:[{block:0,start:0,end:text.length}]}};
 return {unit,record,metadata:snapshotIsrRatings([record],[unit])};
}
describe('authoritative ISR numerical valence metadata',()=>{
 it.each([
  ['Transparent',1,'negative'],['Transparent',5,'positive'],
  ['A Person of Integrity',1,'negative'],['A Person of Integrity',5,'positive'],
  ['Overall Rating',1,'negative'],['Overall Rating',5,'positive'],
  ['Overall Rating to nearest number',5,'positive'],['Fair',3,'midpoint'],['Flexible',4,'positive'],['Genuine',2,'negative'],
 ])('supplies known valence for %s %s without supplying a competency', (field,value,valence)=>{
  const {metadata}=fixture(field+' '+value);expect(metadata.ratings).toHaveLength(1);
  expect(metadata.ratings[0]).toMatchObject({field,value,numericalValence:valence});
  expect(metadata.ratings[0]).not.toHaveProperty('competencyId');
  const request=isrMetadataForRequest({ambiguityProtocol:2,ambiguitySourceMetadata:metadata},'set');
  expect(request.instructions).toContain('Do not flag these rating fields as ambiguous merely because the review does not repeat the scale anchors or direction');
  expect(request.instructions).toContain('Known rating direction does not establish competency application or resolve a referent');
 });
 it.each(['Flexible 4','Fair 3'])('retains genuine referent/competency ambiguity for %s',text=>{
  const {unit,metadata}=fixture(text),before=JSON.stringify(metadata);
  const input={status:'identified',reason:text.startsWith('Flexible')?'Interpersonal accommodation or organisational adaptability?':'Moral decision-making or equity and inclusion?',evidence:[{unitId:id,quote:text}],alternatives:[{competencyId:text.startsWith('Flexible')?'B3':'D3',interpretation:'A plausible competency interpretation remains unresolved.',evidence:[{unitId:id,quote:text}]}]};
  const a=retainAiAmbiguity(input,[],unit,[unit],[id],{protocolVersion:2,sourceMetadata:metadata});
  expect(a.status).toBe('identified');expect(a.alternatives).toHaveLength(1);expect(JSON.stringify(metadata)).toBe(before);
  const proposals=[{unit_id:id,payload:{method:'ai',codes:[],ambiguity:a}}];
  expect(aiAmbiguitySummary([unit],proposals)).toMatchObject({flagged:1,alternativeMentions:1});
  expect(competencyEvidenceCounts(proposals)).toEqual(competencyEvidenceCounts([]));
 });
 it('does not change any supported competency counts when metadata is attached',()=>{
  const {unit,metadata}=fixture('Transparent 1');
  const codes=[{competencyId:'G2',evidenceStrength:'Explicit',evidenceProtocol:2,context:[]}];
  const before=[{unit_id:id,payload:{method:'ai',codes}}];const untouched=JSON.stringify(before),instrument=JSON.stringify(MCF);
  const ambiguity=retainAiAmbiguity({status:'none',reason:'No unresolved reading in this fixture.',evidence:[],alternatives:[]},codes,unit,[unit],[id],{protocolVersion:2,sourceMetadata:metadata});
  expect(competencyEvidenceCounts([{...before[0],payload:{...before[0]!.payload,ambiguity}}])).toEqual(competencyEvidenceCounts(before));
  expect(JSON.stringify(before)).toBe(untouched);expect(JSON.stringify(MCF)).toBe(instrument);
 });
 it('limits application to mapped questionnaire spans in the same review',()=>{
  const {record,unit}=fixture('Transparent 1');
  expect(snapshotIsrRatings([{...record,locator:{...record.locator,profile:'manual-review-boundaries@1.0'}}],[unit]).ratings).toEqual([]);
  expect(snapshotIsrRatings([{...record,locator:{...record.locator,components:[{index:0,component:'narrative'}]}}],[unit]).ratings).toEqual([]);
  expect(snapshotIsrRatings([record],[{...unit,record_id:'other'}]).ratings).toEqual([]);
  expect(snapshotIsrRatings([record],[{...unit,start_offset:12}]).ratings).toEqual([]);
  expect(isrMetadataForRequest({ambiguityProtocol:2,ambiguitySourceMetadata:fixture('Transparent 1').metadata},'other-set').instructions).toBe('');
 });
 it('preserves exact source spans and supports table separators without guessing missing ratings',()=>{
  const {metadata}=fixture('Transparent\t1\nA Person of Integrity\n5\nFlexible\t4 / 5');
  expect(metadata.ratings.map(r=>r.value)).toEqual([1,5,4]);
  for(const text of ['Transparent','Transparent 0','Transparent 6','Transparent 1.5','Transparent 10','Transparent 1/10','Unknown 5','This narrative says Transparent 1'])expect(fixture(text).metadata.ratings).toEqual([]);
  expect(isrRating('Unknown',1)).toBeNull();expect(isrRating('Fair',1.5)).toBeNull();
 });
 it('recognises the real DOCX non-breaking spaces while preserving verbatim evidence',()=>{
  const text='Transparent\t\u00a05\nA Person of Integrity\t\u00a01\nOverall Rating to nearest number\t\u00a03';
  const {metadata}=fixture(text);
  expect(metadata.ratings.map(r=>r.numericalValence)).toEqual(['positive','negative','midpoint']);
  for(const r of metadata.ratings)expect(text.slice(r.startOffset,r.endOffset)).toBe(r.quote);
  expect(metadata.ratings[0]?.quote).toBe('Transparent\t\u00a05');
 });
 it('leaves historical protocols untouched and uses the saved metadata snapshot',()=>{
  const {metadata}=fixture('Transparent 1');
  for(const protocol of [undefined,1])expect(isrMetadataForRequest({...(protocol?{ambiguityProtocol:protocol}:{}),ambiguitySourceMetadata:metadata},'set')).toEqual({metadata:null,instructions:''});
  const saved={...metadata,instructions:'Frozen source instructions'};
  expect(isrMetadataForRequest({ambiguityProtocol:2,ambiguitySourceMetadata:saved},'set').instructions).toContain('Frozen source instructions');
 });
 it('snapshots the source-scale metadata alongside the current reasoning policy without changing evidence/ambiguity protocols',async()=>{
  const {unit,record}=fixture('Transparent 1');let configuration:any;
  const session={dataset_id:'dataset',instrument_hash:MCF_HASH,units:[unit],contextUnits:[unit],records:[record],configuration:{unitSets:[{id:'set',record_id:'review'}]}};
  const c={query:async(sql:string,args:any[])=>{if(sql.startsWith('INSERT INTO researched.mcf_ai_runs'))configuration=JSON.parse(args[3]);return{rows:[]};}};
  const repo:any={workspace:async()=>session,transaction:async(fn:any)=>fn(c),writable:async()=>{},active:async()=>{},audit:async()=>{}};
  await new SemanticWorker(repo,()=>null).enqueue('session','researcher',true);
  expect(configuration).toMatchObject({semanticProtocol:3,evidenceProtocol:2,ambiguityProtocol:2,instrumentHash:MCF_HASH});
  expect(configuration.classificationConfig.rules).toBe(CLASSIFICATION_RULES_V9);
  expect(configuration.classificationConfig.promptVersion).toBe('mcf-evidential-proposals.v3');
  expect(configuration.ambiguitySourceMetadata.ratings[0]).toMatchObject({field:'Transparent',value:1,numericalValence:'negative'});
 });
});
