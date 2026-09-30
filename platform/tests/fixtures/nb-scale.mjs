// Test-only topology: never imported into any application store.
export function scaleFixture(count=5000,edgeCount=30000){
 const references=Array.from({length:10},(_,i)=>({id:`role-${i}`,kind:'role',data:{name:`SYNTHETIC role ${i}`}})).concat(Array.from({length:12},(_,i)=>({id:`domain-${i}`,kind:'term',data:{name:`Synthetic domain ${i}`,category:'domain'}})));
 const nodes=Array.from({length:count},(_,i)=>({id:`N${i}`,kind:'responsibility',revision:1,data:{name:`Synthetic responsibility ${i}`,normalized_statement:`Synthetic responsibility ${i}`,role_id:`role-${i%10}`,domain_ids:[`domain-${i%12}`],statement_id:`S${Math.floor(i/5)}`,statement_revision:1,review_status:'draft',status:'draft',evidence:'documentary'}}));
 const edges=[],seen=new Set();function add(a,b,companion=false){if(a===b||seen.has(`${a}:${b}`))return;seen.add(`${a}:${b}`);edges.push({id:`E${edges.length}`,kind:'connection',revision:1,data:{from_id:`N${a}`,to_id:`N${b}`,evidence:companion?'documentary':'inferred',review_status:'draft',status:'draft',relationship_type_id:companion?'companion':'directed'},semantics:{directionality:companion?'symmetric':'directed',grouping:companion?'source_statement':null,source_statement_id:companion?`S${Math.floor(a/5)}`:null,statement_revision:companion?1:null}});}
 for(let i=0;i<3000;i++)if(i%5!==4)add(i,i+1,true);
 for(let i=1;i<2000;i++)add(0,i); // high-degree hub
 for(let i=3000;i<4499;i++)add(i,i+1); // long directed chain
 for(let i=0;edges.length<edgeCount;i++){const cluster=i%6,a=(i*37)%700+cluster*700,b=(i*53+Math.floor(i/4200)+1)%700+cluster*700;add(a,b);}
 return {nodes,edges,references,gaps:[],diagnostics:[],revision:'synthetic-only',statement_groups:[],corpus:{sources:0,responsibilities:count}};
}
