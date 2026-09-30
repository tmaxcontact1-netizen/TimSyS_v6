export const DEFAULTS = {role:'',domain:'',subdomain:'',action:'',authority:'',level:'',source:'',evidence:'',review:'',relationship:'',isolates:false,gapsOnly:false,referenced:'',companions:true,inferred:true,showGaps:false,context:true,group:'',direction:'both',depth:'2'};
export const title = r => r?.data?.normalized_statement || r?.data?.name || r?.id || 'Unknown';
export const groupKey = n => `${n.data.statement_id}:${n.data.statement_revision}`;
export function adapt(raw) {
  const references=new Map(raw.references.map(r=>[r.id,r])), nodes=new Map(raw.nodes.map(n=>[n.id,n]));
  const degree=new Map(raw.nodes.map(n=>[n.id,0])), groups=new Map(), adjacency=new Map(raw.nodes.map(n=>[n.id,[]]));
  for(const e of raw.edges) {
    if(!nodes.has(e.data.from_id)||!nodes.has(e.data.to_id)) throw new Error(`Connection ${e.id} references a missing responsibility. Refresh or review the governed data.`);
    for(const id of [e.data.from_id,e.data.to_id]){degree.set(id,degree.get(id)+1);adjacency.get(id).push(e);}
  }
  for(const n of raw.nodes){const key=groupKey(n);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n.id);}
  const label=id=>title(references.get(id));
  const search=new Map(raw.nodes.map(n=>[n.id,[n.id,title(n),label(n.data.role_id),label(n.data.source_id),...(n.data.domain_ids||[]).map(label)].join(' ').toLowerCase()]));
  return {...raw,byId:nodes,references,degree,groups,adjacency,search,label};
}
export function selectGraph(model, f, selected) {
  const gapRoots=new Set(model.gaps.filter(g=>!f.referenced||g.target_role_name===f.referenced).map(g=>g.responsibility_id));
  const matches=(n,boundary=false)=> {
    const d=n.data;
    return (boundary||!f.role||d.role_id===f.role)&&(boundary||!f.domain||d.domain_ids?.includes(f.domain))&&(!f.subdomain||d.domain_ids?.includes(f.subdomain))&&(!f.action||d.responsibility_type_ids?.includes(f.action))&&(!f.authority||d.authority_type_ids?.includes(f.authority))&&(!f.level||d.level_id===f.level)&&(!f.source||d.source_id===f.source)&&(!f.review||d.review_status===f.review)&&(!f.isolates||model.degree.get(n.id)===0)&&(!(f.gapsOnly||f.referenced)||gapRoots.has(n.id))&&(!f.group||groupKey(n)===f.group);
  };
  const eligible=model.edges.filter(e=>(f.companions||e.semantics.grouping!=='source_statement')&&(f.inferred||e.data.evidence!=='inferred')&&(!f.evidence||e.data.evidence===f.evidence)&&(!f.relationship||e.data.relationship_type_id===f.relationship)&&(!f.review||e.data.review_status===f.review));
  const primary=new Set(model.nodes.filter(n=>matches(n)).map(n=>n.id)), ids=new Set(primary);
  // Explicit role/domain focus keeps one boundary hop; strict filtering is selectable.
  if(f.context&&(f.role||f.domain)&&!f.group&&!f.isolates) for(const e of eligible) if(primary.has(e.data.from_id)||primary.has(e.data.to_id)){for(const id of [e.data.from_id,e.data.to_id])if(matches(model.byId.get(id),true))ids.add(id);}
  const nodes=model.nodes.filter(n=>ids.has(n.id)), edges=eligible.filter(e=>ids.has(e.data.from_id)&&ids.has(e.data.to_id));
  const trail={...traverse(nodes,edges,selected,f.direction,f.depth),filters:{...f},evidence_scope:{evidence:f.evidence||'all',include_inferred:f.inferred,include_companions:f.companions}};
  const gaps=f.showGaps?model.gaps.filter(g=>ids.has(g.responsibility_id)&&(!f.referenced||g.target_role_name===f.referenced)):[];
  return {nodes,edges,gaps,primary,trail,selectedExcluded:!!selected&&!ids.has(selected),totalNodes:model.nodes.length,totalEdges:model.edges.length};
}
export function traverse(nodes,edges,root,direction,depth) {
  const ids=new Set(nodes.map(n=>n.id)), reached=new Set(), traversed=new Set(), adjacency=new Map(), groups=new Map(), groupEdges=new Map();
  const add=(id,x)=>{if(!adjacency.has(id))adjacency.set(id,[]);adjacency.get(id).push(x);};
  // Documentary groups cost zero organisational hops; no virtual connections are exported.
  for(const e of edges){const a=e.data.from_id,b=e.data.to_id;if(e.semantics.grouping==='source_statement'){
      const k=`${e.semantics.source_statement_id}:${e.semantics.statement_revision}`;
      if(!groups.has(k)){groups.set(k,new Set());groupEdges.set(k,[]);}groups.get(k).add(a);groups.get(k).add(b);groupEdges.get(k).push(e.id);
    } else {if(e.semantics.directionality==='symmetric'||direction!=='upstream')add(a,[b,e.id]);if(e.semantics.directionality==='symmetric'||direction!=='downstream')add(b,[a,e.id]);}}
  const membership=new Map();for(const [k,set] of groups)for(const id of set)membership.set(id,k);
  if(!ids.has(root))return {root,nodes:[],edges:[],direction,depth};
  const expandedGroups=new Set();
  function close(frontier){const result=[];for(const id of frontier){if(!reached.has(id)){reached.add(id);result.push(id);}const k=membership.get(id);if(k&&!expandedGroups.has(k)){expandedGroups.add(k);for(const n of groups.get(k))if(!reached.has(n)){reached.add(n);result.push(n);}for(const e of groupEdges.get(k))traversed.add(e);}}return result;}
  let frontier=close([root]);const limit=depth==='full'?nodes.length:Number(depth);
  for(let hop=0;hop<limit&&frontier.length;hop++){const next=[];for(const id of frontier)for(const [target,e] of adjacency.get(id)||[]){traversed.add(e);if(!reached.has(target))next.push(target);}frontier=close(next);}
  return {root,nodes:[...reached],edges:[...traversed],direction,depth};
}
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function layout(model) {
  const start=performance.now(), domains=[...new Set(model.nodes.map(n=>(n.data.domain_ids||[]).find(id=>!model.references.get(id)?.data.parent_id)||'unknown'))].sort();
  const centers=new Map(domains.map((id,i)=>{const a=i/domains.length*Math.PI*2;return [id,{x:Math.cos(a)*430,y:Math.sin(a)*430,z:Math.sin(a*3)*120}];}));
  const positions=new Map(), origins=new Map(), groupIndex=new Map();
  for(const [k,members] of model.groups){members.slice().sort().forEach((id,i)=>groupIndex.set(id,{i,count:members.length,key:k}));}
  for(const n of model.nodes){const d=n.data,domain=(d.domain_ids||[]).find(id=>centers.has(id))||'unknown',c=centers.get(domain)||{x:0,y:0,z:0},g=groupIndex.get(n.id),h=hash(g.key),a=(h%6283)/1000,r=35+(h%140),angle=g.i*2.399963;
    const p={x:c.x+Math.cos(a)*r+Math.cos(angle)*9*Math.sqrt(g.i+1),y:c.y+Math.sin(a)*r+Math.sin(angle)*9*Math.sqrt(g.i+1),z:c.z+((hash([d.level_id,d.authority_type_ids,d.role_id,d.domain_ids?.[1]].join('|'))%160)-80)+Math.sin(angle)*8};positions.set(n.id,p);origins.set(n.id,{...p});}
  // Bounded deterministic topology relaxation. No simulation or drift in renderers.
  for(let step=0;step<10;step++){const delta=new Map(model.nodes.map(n=>[n.id,{x:0,y:0,z:0,count:0}]));for(const e of model.edges){if(e.semantics.grouping==='source_statement')continue;const a=positions.get(e.data.from_id),b=positions.get(e.data.to_id);for(const [id,p,q] of [[e.data.from_id,a,b],[e.data.to_id,b,a]]){const d=delta.get(id);for(const axis of ['x','y','z'])d[axis]+=q[axis]-p[axis];d.count++;}}for(const [id,p] of positions){const d=delta.get(id),o=origins.get(id);for(const axis of ['x','y','z'])p[axis]+=(o[axis]-p[axis])*.2+(d.count?d[axis]/d.count*.045:0);}}
  return {positions,centers,version:'domain-statement-topology-v1',duration:performance.now()-start};
}
export function searchNodes(model,q){const text=q.trim().toLowerCase();return model.nodes.filter(n=>!text||model.search.get(n.id).includes(text));}
export function encoding(edge){return {symmetric:edge.semantics.directionality==='symmetric',companion:edge.semantics.grouping==='source_statement',draft:edge.data.review_status!=='reviewed'||edge.data.status!=='active'};}
