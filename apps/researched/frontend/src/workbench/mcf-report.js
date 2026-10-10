export function summariseMcf(session,instrument,draft,machine){
 const saved=draft.step===5?draft.machineReport:null;
 const run=saved?.run??machine?.runs?.find(r=>r.id===draft.machineRunId);
 const proposals=(saved?.proposals??machine?.proposals??[]).filter(p=>p.run_id===run?.id);
 const byUnit=new Map(proposals.map(p=>[p.unit_id,p.payload]));
 const units=session?.units??[];
 const findings=units.flatMap(unit=>{
  const human=draft.decisions?.[unit.id],original=byUnit.get(unit.id),local=original?.method==='deterministic';
  const value=human??(local?{...original,codes:original.matches.map(m=>({...m,evidenceStrength:null,valence:null}))}:original);
  return value?[{unit,value,human:!!human,local:!human&&local}]:[];
 });
 const competencies=(instrument?.competencies??[]).map(c=>({...c,findings:findings.flatMap(f=>f.value.codes.filter(code=>code.competencyId===c.id).map(code=>({...f,code})))}));
 return {run,deterministic:proposals.filter(p=>p.payload.method==='deterministic').length,competencies,findings,total:units.length,analysed:byUnit.size,missing:units.filter(u=>!byUnit.has(u.id)),human:findings.filter(f=>f.human).length,noCode:findings.filter(f=>!f.value.codes.length),contextual:findings.filter(f=>f.value.codes.some(c=>c.evidenceStrength==='Implicit'||c.valence==='mixed-ambiguous'))};
}
