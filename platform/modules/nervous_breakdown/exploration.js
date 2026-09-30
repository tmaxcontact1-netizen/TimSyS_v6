'use strict';
const model = require('./model');
const overlay = require('./gap-overlay.json');
const crypto = require('crypto');
// Read projections only. The overlay is an analytical artefact, never graph edges.
function project(records, query, app) {
  const byId = new Map(records.map(r => [r.id, r]));
  for (const r of records) if(r.kind==='connection'&&['draft','active'].includes(r.data.status)&&[r.data.from_id,r.data.to_id].some(id=>byId.get(id)?.kind!=='responsibility')) model.fail(`Connection ${r.id} references a missing responsibility`, 'TOPOLOGY_INTEGRITY');
  const graph = model.graph(records, { mode: query.mode || 'normal', fixtures: query.fixtures, status: query.mode === 'draft_review' ? 'all' : 'active' });
  const nodes = graph.nodes.filter(n => ['draft', 'active'].includes(n.data.status));
  const ids = new Set(nodes.map(n => n.id));
  const edges = graph.edges.filter(e => ids.has(e.data.from_id) && ids.has(e.data.to_id));
  const refs = records.filter(r => ['role','source','term'].includes(r.kind) && r.data.is_fixture === (query.fixtures === 'true'));
  const gaps = [], diagnostics = [];
  if (query.mode === 'draft_review' && app === overlay.app_id && query.fixtures !== 'true') {
    for (const raw of overlay.handoffs) {
      const node = byId.get(raw['Source Responsibility ID']);
      if (!node || node.data.statement_id !== raw['Evidence Source Statement ID']) {
        diagnostics.push({ code:'GAP_BINDING_CHANGED', id:raw['Connection ID'], message:'Unresolved handoff source binding requires governance review.' }); continue;
      }
      if (!ids.has(node.id)) continue;
      const target = refs.find(r => r.kind === 'role' && r.data.name === raw['Target Role']);
      gaps.push({ id:raw['Connection ID'], responsibility_id:node.id, target_role_name:raw['Target Role'], target_role_id:target?.id || null,
        target_has_mapped_responsibilities:!!target && nodes.some(n=>n.data.role_id===target.id),
        statement_id:node.data.statement_id, statement_revision:node.data.statement_revision, evidence:raw['Evidence Status'], review_status:raw['Review Status'],
        resolution:raw['Resolution Status'], relationship_type_id:raw['Relationship Type ID'], rationale:raw.Rationale, original:raw });
    }
  }
  const fields=['name','normalized_statement','role_id','statement_id','statement_revision','domain_ids','responsibility_type_ids','authority_type_ids','level_id','level','evidence','review_status','status'];
  return { nodes:nodes.map(n=>({id:n.id,kind:n.kind,revision:n.revision,data:{...Object.fromEntries(fields.map(k=>[k,n.data[k]])),source_id:byId.get(n.data.statement_id)?.data.source_id}})),
    edges:edges.map(e=>({id:e.id,kind:e.kind,revision:e.revision,semantics:e.semantics,data:Object.fromEntries(['from_id','to_id','relationship_type_id','evidence','review_status','status','statement_id','statement_revision'].map(k=>[k,e.data[k]]))})),
    references:refs,gaps,diagnostics,revision:crypto.createHash('sha256').update(JSON.stringify(records.map(r=>[r.id,r.revision]))).digest('hex'),
    overlay:query.mode==='draft_review'?{format:overlay.format,source_sha256:overlay.source_sha256}:null,
    statement_groups:graph.statement_groups.map(g=>({...g,nodes:g.nodes.filter(id=>ids.has(id))})),
    corpus:{sources:refs.filter(r=>r.kind==='source').length,responsibilities:records.filter(r=>r.kind==='responsibility'&&!r.data.is_fixture&&['draft','active'].includes(r.data.status)).length}
  };
}
module.exports={project};
