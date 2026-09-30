// Presentation coordinates only. No value is written into a governed record.
export const VERSION='semantic-territories-v1';
export const LEVEL_BANDS={'LEV-01':0,'LEV-06':1,'LEV-07':1,'LEV-03':2,'LEV-04':2,'LEV-02':3,'LEV-05':4};
export const PARAMETERS={levelSpacing:260,familyCell:66,nodeSpacing:15,minimumTerritory:260};
const key=n=>`${n.data.statement_id||'unknown:'+n.id}:${n.data.statement_revision||0}`;
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function domainOf(model,n){return (n.data.domain_ids||[]).filter(id=>{const t=model.references.get(id);return t?.data.category==='domain'&&!t.data.parent_id;}).sort()[0]||'unknown';}
export function levelOf(model,n){return model.references.get(n.data.level_id)?.data.category==='responsibility_level'?n.data.level_id:'unknown';}
export function bandOf(model,n){return LEVEL_BANDS[levelOf(model,n)]??-1;}
export function relationshipClass(e){const id=e.data.relationship_type_id;return id==='REL-010'?'family':['REL-004','REL-005'].includes(id)?'accountability':['REL-003','REL-009'].includes(id)?'support':['REL-001','REL-002','REL-008'].includes(id)?'lateral':id==='REL-006'?'referral':'related';}
export function semanticLayout(model){
 const started=performance.now(),positions=new Map(),positions2d=new Map(),centers=new Map(),centers2d=new Map(),meta=new Map(),families=new Map();
 const domains=[...new Set(model.nodes.map(n=>domainOf(model,n)))],domainCounts=new Map(domains.map(d=>[d,model.nodes.filter(n=>domainOf(model,n)===d).length]));
 const weights=new Map(),roles=new Map(domains.map(d=>[d,new Set()]));
 const add=(a,b,w)=>{if(a===b)return;const k=[a,b].sort().join('|');weights.set(k,(weights.get(k)||0)+w);};
 for(const n of model.nodes){const domain=domainOf(model,n),level=levelOf(model,n),band=bandOf(model,n),family=key(n),sub=(n.data.domain_ids||[]).filter(id=>model.references.get(id)?.data.parent_id===domain).sort()[0]||'unknown';meta.set(n.id,{domain,level,band,family,role:n.data.role_id,subdomain:sub});roles.get(domain).add(n.data.role_id);if(!families.has(family))families.set(family,[]);families.get(family).push(n.id);}
 for(const e of model.edges)if(e.semantics.grouping!=='source_statement')add(meta.get(e.data.from_id).domain,meta.get(e.data.to_id).domain,1);
 for(const members of families.values()){const ds=[...new Set(members.map(id=>meta.get(id).domain))];for(let i=0;i<ds.length;i++)for(let j=i+1;j<ds.length;j++)add(ds[i],ds[j],.35);}
 for(let i=0;i<domains.length;i++)for(let j=i+1;j<domains.length;j++)add(domains[i],domains[j],[...roles.get(domains[i])].filter(r=>roles.get(domains[j]).has(r)).length*.12);
 const weight=(a,b)=>weights.get([a,b].sort().join('|'))||0,degree=d=>domains.reduce((v,x)=>v+weight(d,x),0);
 // Greedy weighted adjacency on a compact hex lattice; ID hash is only a tie-break.
 const remaining=domains.slice().sort((a,b)=>degree(b)-degree(a)||domainCounts.get(b)-domainCounts.get(a)||hash(a)-hash(b)),order=[],slots=[];
 const extent=Math.max(5,Math.ceil(Math.sqrt(domains.length)));for(let q=-extent;q<=extent;q++)for(let r=-extent;r<=extent;r++)slots.push({x:q+r/2,z:r*Math.sqrt(3)/2});
 while(remaining.length){if(order.length)remaining.sort((a,b)=>order.reduce((s,x)=>s+weight(b,x)-weight(a,x),0)||degree(b)-degree(a)||hash(a)-hash(b));const d=remaining.shift();const candidates=slots.filter(s=>![...centers.values()].some(p=>p.x===s.x&&p.z===s.z));const cost=s=>order.length?order.reduce((sum,x)=>{const p=centers.get(x);return sum+(weight(d,x)+.05)*Math.hypot(s.x-p.x,s.z-p.z);},0)+Math.hypot(s.x,s.z)*.1:Math.hypot(s.x,s.z);candidates.sort((a,b)=>cost(a)-cost(b)||a.z-b.z||a.x-b.x);centers.set(d,{...candidates[0],y:0});order.push(d);}
 const buckets=new Map();for(const n of model.nodes){const m=meta.get(n.id),k=[m.domain,m.band].join('|');if(!buckets.has(k))buckets.set(k,new Map());const b=buckets.get(k),part=m.family;if(!b.has(part))b.set(part,[]);b.get(part).push(n.id);}
 const maxGroups=Math.max(1,...[...buckets.values()].map(b=>b.size)),cols=Math.max(3,Math.ceil(Math.sqrt(maxGroups))),cell=PARAMETERS.familyCell,span=Math.max(PARAMETERS.minimumTerritory,(cols+1)*cell),pitch=span*1.25;
 const levelSpacing=Math.max(PARAMETERS.levelSpacing,Math.ceil(maxGroups/cols)*cell+60);
 for(const c of centers.values()){c.x*=pitch;c.z*=pitch;}
 // 2D has independent columns and level lanes, never a flattened 3D projection.
 const ordered=order.slice().sort((a,b)=>centers.get(a).x-centers.get(b).x||centers.get(a).z-centers.get(b).z);
 ordered.forEach((d,i)=>centers2d.set(d,{x:(i-(ordered.length-1)/2)*(span+50),y:0,z:0}));
 const segments=[];
 for(const [bucket,groups] of buckets){const [domain,bandString]=bucket.split('|'),band=Number(bandString),c=centers.get(domain),c2=centers2d.get(domain);const sorted=[...groups.entries()].sort((a,b)=>{const m=meta.get(a[1][0]),n=meta.get(b[1][0]);return m.subdomain.localeCompare(n.subdomain)||String(m.role).localeCompare(String(n.role))||a[0].localeCompare(b[0]);});const rows=Math.ceil(sorted.length/cols);
  sorted.forEach(([family,ids],i)=>{ids.sort();const gx=(i%cols-(Math.min(cols,sorted.length)-1)/2)*cell,gz=(Math.floor(i/cols)-(rows-1)/2)*cell;const width=Math.ceil(Math.sqrt(ids.length));ids.forEach((id,j)=>{const dx=(j%width-(width-1)/2)*PARAMETERS.nodeSpacing,dz=(Math.floor(j/width)-(Math.ceil(ids.length/width)-1)/2)*PARAMETERS.nodeSpacing;positions.set(id,{x:c.x+gx+dx,y:band*levelSpacing,z:c.z+gz+dz});positions2d.set(id,{x:c2.x+gx+dx,y:band*levelSpacing-gz-dz,z:0});});segments.push({id:family+'|'+domain+'|'+band,family,domain,band,ids});});
 }
 const levels=[...new Set([...meta.values()].map(m=>m.level))].map(id=>({id,band:LEVEL_BANDS[id]??-1,label:id==='unknown'?'Unknown / Unclassified':model.label(id)})).sort((a,b)=>b.band-a.band||a.id.localeCompare(b.id));
 return {positions,positions2d,centers,centers2d,meta,families,segments,levels,domainOrder:ordered,span,levelSpacing,version:VERSION,weights:[...weights],duration:performance.now()-started};
}
export function focusLayout(model,geography,graph,selected,context=null,familyExpanded=false){
 const contextIds=context?[selected,...context.directIds,...graph.trail.nodes.filter(id=>!context.familyIds.has(id)),...(familyExpanded?context.family:[])]:graph.trail.nodes;
 const ids=[...new Set(contextIds)].filter(id=>graph.nodes.some(n=>n.id===id)&&geography.positions.has(id)),set=new Set(ids);if(!ids.length)return geography;
 const positions=new Map(geography.positions),positions2d=new Map(geography.positions2d),root=geography.positions.get(selected),root2=geography.positions2d.get(selected),rootBand=geography.meta.get(selected).band;
 const bands=new Map();for(const id of ids){const m=geography.meta.get(id);if(!bands.has(m.band))bands.set(m.band,new Map());const families=bands.get(m.band);if(!families.has(m.family))families.set(m.family,[]);families.get(m.family).push(id);}
 const familyX=new Map();const localSegments=[];
 for(const [band,groups] of bands){const sorted=[...groups].sort((a,b)=>{const ma=geography.meta.get(a[1][0]),mb=geography.meta.get(b[1][0]);return geography.domainOrder.indexOf(ma.domain)-geography.domainOrder.indexOf(mb.domain)||String(ma.role).localeCompare(String(mb.role))||a[0].localeCompare(b[0]);});let cursor=0;const entries=sorted.map(([family,members])=>{const width=Math.max(230,Math.ceil(Math.sqrt(members.length))*170);const x=cursor+width/2;cursor+=width+90;return {family,members,width,x};});for(const e of entries){e.x-=cursor/2;familyX.set(e.family+'|'+band,e.x);}}
 // Barycentric neighbour alignment is constrained to the classified level lane.
 for(let pass=0;pass<2;pass++)for(const [band,groups] of bands){const entries=[...groups].map(([family,members])=>{const neighbors=[];for(const id of members)for(const edge of model.adjacency.get(id)||[]){if(edge.semantics.grouping==='source_statement')continue;const other=edge.data.from_id===id?edge.data.to_id:edge.data.from_id;if(!set.has(other))continue;const m=geography.meta.get(other);neighbors.push({x:familyX.get(m.family+'|'+m.band)||0,w:relationshipClass(edge)==='lateral'?1.5:1});}const k=family+'|'+band,old=familyX.get(k);return {k,members,x:neighbors.length?old*.65+neighbors.reduce((s,n)=>s+n.x*n.w,0)/neighbors.reduce((s,n)=>s+n.w,0)*.35:old};}).sort((a,b)=>a.x-b.x||a.k.localeCompare(b.k));let end=-Infinity;for(const e of entries){const width=Math.max(230,Math.ceil(Math.sqrt(e.members.length))*170);const x=Math.max(e.x,end+width/2);familyX.set(e.k,x);end=x+width/2+90;}}
 const focusLevelSpacing=Math.max(330,...[...bands.values()].flatMap(groups=>[...groups.values()].map(members=>Math.ceil(members.length/Math.ceil(Math.sqrt(members.length)))*90+120)));
 const rootFamily=geography.meta.get(selected).family,anchorX=familyX.get(rootFamily+'|'+rootBand)||0;
 for(const [band,groups] of bands)for(const [family,members] of groups){members.sort();const cols=Math.ceil(Math.sqrt(members.length)),gx=familyX.get(family+'|'+band)-anchorX;members.forEach((id,i)=>{const m=geography.meta.get(id),dx=(i%cols-(cols-1)/2)*170,row=Math.floor(i/cols),y=(band-rootBand)*focusLevelSpacing;positions.set(id,{x:root.x+gx+dx,y:root.y+y-row*90,z:root.z+(geography.domainOrder.indexOf(m.domain)-geography.domainOrder.indexOf(geography.meta.get(selected).domain))*28});positions2d.set(id,{x:root2.x+gx+dx,y:root2.y+y-row*90,z:0});});localSegments.push({id:family+'|focus|'+band,family,band,ids:members,domain:geography.meta.get(members[0]).domain});}
 // Keep the selected atomic responsibility at its global anchor exactly.
 for(const [map,anchor] of [[positions,root],[positions2d,root2]]){const p=map.get(selected),delta={x:anchor.x-p.x,y:anchor.y-p.y,z:anchor.z-p.z};for(const id of ids){const q=map.get(id);map.set(id,{x:q.x+delta.x,y:q.y+delta.y,z:q.z+delta.z});}}
 return {...geography,positions,positions2d,globalPositions:geography.positions,globalPositions2d:geography.positions2d,segments:localSegments,focused:true,focusIds:ids};
}
export function visibleEdges(graph,selected,showAll=false){return graph.edges.filter(e=>e.semantics.grouping!=='source_statement'||showAll);}
export const PALETTE=['#6fdac5','#f2bd7d','#99b7ff','#db9ddf','#b5d481','#76c6ea','#f39d9d'];
const colourCache=new WeakMap();
export function nodeColor(model,n,by='role'){if(!colourCache.has(model))colourCache.set(model,{role:[...model.references.values()].filter(r=>r.kind==='role').map(r=>r.id).sort(),domain:[...new Set(model.nodes.map(n=>domainOf(model,n)))].sort()});const values=colourCache.get(model)[by],id=by==='role'?n.data.role_id:domainOf(model,n);return PALETTE[Math.max(0,values.indexOf(id))%PALETTE.length];}
