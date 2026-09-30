import test from 'node:test';
import assert from 'node:assert/strict';
import {adapt,layout,selectGraph,traverse,DEFAULTS,encoding,searchNodes} from '../../../apps/principaled/src/dashboard/widgets/layer1/model.mjs';
import {scaleFixture} from '../fixtures/nb-scale.mjs';
const nodes=['A','B','C','D','I'].map(id=>({id,data:{role_id:id==='C'?'other':'role',normalized_statement:id==='A'||id==='B'?'Same wording':id,statement_id:id==='A'||id==='B'?'S':'S'+id,statement_revision:1,domain_ids:['domain'],review_status:'draft',status:'draft'}}));
const edge=(id,a,b,symmetric=false,group=false)=>({id,data:{from_id:a,to_id:b,evidence:symmetric?'documentary':'inferred',review_status:'draft',status:'draft'},semantics:{directionality:symmetric?'symmetric':'directed',grouping:group?'source_statement':null,source_statement_id:group?'S':null,statement_revision:group?1:null}});
const edges=[edge('AB','A','B',true,true),edge('BC','B','C'),edge('DC','D','C')];
const raw={nodes,edges,references:[],gaps:[{id:'G',responsibility_id:'A',target_role_name:'unmapped'}],diagnostics:[]};
test('mixed direction, symmetric grouping and organisational depth are renderer neutral',()=>{
 assert.deepEqual(new Set(traverse(nodes,edges,'A','downstream','1').nodes),new Set(['A','B','C']));
 assert.deepEqual(new Set(traverse(nodes,edges,'C','upstream','full').nodes),new Set(['A','B','C','D']));
 assert.deepEqual(traverse(nodes,edges,'C','downstream','full').nodes,['C']);
 assert.equal(encoding(edges[0]).symmetric,true);assert.equal(encoding(edges[0]).draft,true);
});
test('evidence filters constrain traversal; isolates and gaps are distinct',()=>{
 const m=adapt(raw);const base=selectGraph(m,DEFAULTS,'A');assert.equal(base.nodes.length,5);assert.equal(base.edges.length,3);assert.equal(base.gaps.length,0);
 const doc=selectGraph(m,{...DEFAULTS,evidence:'documentary'},'A');assert.deepEqual(new Set(doc.trail.nodes),new Set(['A','B']));
 assert.equal(selectGraph(m,{...DEFAULTS,companions:false},'A').edges.length,2);
 assert.equal(selectGraph(m,{...DEFAULTS,isolates:true},'').nodes[0].id,'I');
 const g=selectGraph(m,{...DEFAULTS,showGaps:true},'');assert.equal(g.gaps.length,1);assert.equal(g.nodes.length,5);assert.equal(g.edges.length,3);
});
test('focus retains boundary context, strict filtering and excluded selection are explicit',()=>{
 const m=adapt(raw);assert(selectGraph(m,{...DEFAULTS,role:'role'},'C').nodes.some(n=>n.id==='C'));
 assert.equal(selectGraph(m,{...DEFAULTS,role:'role',context:false},'C').selectedExcluded,true);
 assert.equal(searchNodes(m,'same wording').length,2);
});
test('layout and exploration do not mutate records or confer governance/authority',()=>{
 const original=JSON.stringify(raw),m=adapt(raw),a=layout(m),b=layout(m);assert.deepEqual(a.positions,b.positions);
 for(const id of ['A','B','C'])selectGraph(m,DEFAULTS,id);
 assert.equal(JSON.stringify(raw),original);assert.equal(m.nodes[0].data.review_status,'draft');assert.equal(encoding(edges[1]).draft,true);
 assert.equal(a.positions.size,5);assert.equal(m.edges.length,3);
});
test('missing endpoints fail explicitly; optional classifications remain unknown',()=>{
 assert.throws(()=>adapt({...raw,edges:[edge('bad','A','missing')]}),/missing responsibility/);
 assert.doesNotThrow(()=>layout(adapt({...raw,nodes:nodes.map(n=>({...n,data:{...n.data,domain_ids:null}}))})));
});
test('5000 / 30000 synthetic pathological topology stays complete',()=>{
 const raw=scaleFixture(),before=JSON.stringify(raw),m=adapt(raw),geo=layout(m),g=selectGraph(m,{...DEFAULTS,depth:'3'},'N0');
 assert.equal(g.nodes.length,5000);assert.equal(g.edges.length,30000);assert.equal(geo.positions.size,5000);
 assert(m.degree.get('N0')>1900);assert([...m.degree.values()].filter(x=>x===0).length>=500);
 assert.equal(JSON.stringify(raw),before);assert.equal(searchNodes(m,'N4999').length,1);
});
