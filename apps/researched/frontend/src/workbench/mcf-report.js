import {reviewAggregation} from '../../../src/domain/review-aggregation.ts';
import {evidenceCounts} from '../../../src/domain/evidence-summary.ts';
import {semanticCoverage} from '../../../src/domain/mcf-coverage.ts';
export function summariseMcf(session,instrument,draft,machine,filter='all'){
 const saved=draft.step===5?(machine?.snapshot??draft.machineReport):null;
 const run=saved?.run??machine?.runs?.find(r=>r.id===draft.machineRunId);
 const proposals=(saved?.proposals??machine?.proposals??[]).filter(p=>p.run_id===run?.id);
 const candidates=saved?.candidates??run?.candidates??[];
 const byUnit=new Map([...candidates,...proposals].map(p=>[p.unit_id,p.payload]));
 const units=(session?.units??[]).filter(u=>u.original_text.trim());
 const coverage=semanticCoverage(session?.units??[],proposals,candidates,saved?.tasks??run?.tasks??[],Object.keys(draft.decisions??{}));
 const findings=units.flatMap(unit=>{
  const human=draft.decisions?.[unit.id],original=byUnit.get(unit.id),local=original?.method==='deterministic';
  const value=human??(local?{...original,codes:original.matches.map(m=>({...m,evidenceStrength:null,valence:null}))}:original);
  return value?[{unit,value,human:!!human,local:!human&&local}]:[];
 });
 const competencies=(instrument?.competencies??[]).map(c=>{const all=findings.flatMap(f=>f.value.codes.filter(code=>code.competencyId===c.id).map(code=>({...f,code})));return {...c,counts:evidenceCounts(all.filter(f=>!f.local).map(f=>f.code)),findings:all.filter(f=>filter==='all'||(filter==='historical'? !f.local&&f.code.evidenceProtocol!==2:f.code.evidenceProtocol===2&&f.code.evidenceStrength===filter))};});
 const reviewLevel=units.every(u=>u.record_id)?reviewAggregation(units,findings.filter(f=>!f.local).map(f=>({unit_id:f.unit.id,payload:f.value}))):null;
 return {run,coverage,reviewLevel,deterministic:coverage.deterministicCandidateMatches+coverage.deterministicNoMatch,competencies,findings,total:units.length,analysed:coverage.semanticAssessed,missing:units.filter(u=>!proposals.some(p=>p.unit_id===u.id&&p.payload.method!=='deterministic')),human:findings.filter(f=>f.human).length,noCode:findings.filter(f=>!f.local&&!f.value.codes.length),contextual:findings.filter(f=>f.value.codes.some(c=>c.evidenceProtocol===2&&c.evidenceStrength==='Contextual'))};
}
