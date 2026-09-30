// Read-only projection of the current, permission-filtered topology. A role
// handoff is never an edge and never supplies a receiving responsibility.
export function selectedContext(model, id) {
  const responsibility=model.byId.get(id);
  if(!responsibility)return null;
  const companions=[],relationships=[];
  for(const edge of model.adjacency.get(id)||[]){
    const otherId=edge.data.from_id===id?edge.data.to_id:edge.data.from_id;
    const entry={edge,other:model.byId.get(otherId),direction:edge.semantics.directionality==='symmetric'?'symmetric':edge.data.from_id===id?'outgoing':'incoming'};
    (edge.semantics.grouping==='source_statement'?companions:relationships).push(entry);
  }
  const family=model.groups.get(`${responsibility.data.statement_id}:${responsibility.data.statement_revision}`)||[];
  const handoffs=model.gapsByResponsibility.get(id)||[];
  return {responsibility,relationships,companions,handoffs,family,statementId:responsibility.data.statement_id,
    directIds:new Set(relationships.map(r=>r.other.id)),familyIds:new Set(family)};
}
export function contextPriority(context,id,trail=[]){
  if(!context)return 5;
  if(id===context.responsibility.id)return 0;
  if(context.directIds.has(id))return 1;
  if(context.familyIds.has(id))return 4;
  return trail.includes(id)?3:5;
}
export function handoffState(gap){return gap.target_has_mapped_responsibilities?'Role mapped · receiving responsibility unresolved':'Role referenced · not mapped in current corpus';}
