const e=require('../platform/modules/execution/engine'),fs=require('fs'),path=require('path'),os=require('os');
const people=[{id:'s',name:'Synthetic',active:true}],results=[];
for(const n of [100,500,2000]){
 const s=e.empty({title:'Synthetic scale check',timezone:'Asia/Riyadh'},'test');s.lifecycle='active';
 s.tasks=Array.from({length:n},(_,i)=>({id:'t'+i,title:'T'+i,lifecycle:i===0?'completed':'open',kind:'ordinary',assignee_staff_id:'s',cycle:1}));
 s.dependencies=Array.from({length:n-1},(_,i)=>({id:'d'+i,from_id:'t'+i,to_id:'t'+(i+1),state:'active'}));
 const projection=[],mutation=[];for(let j=0;j<12;j++){
  let a=performance.now();e.project(s,people,'2026-10-04');projection.push(performance.now()-a);
  a=performance.now();e.mutate(s,{type:'task.complete',data:{task_id:'t1'}},{people,today:'2026-10-04',actor:'test',lead:true,staffId:'s'});mutation.push(performance.now()-a);
 }
 results.push({tasks:n,dependencies:n-1,projectionMaxMs:Math.max(...projection),engineMutationMaxMs:Math.max(...mutation)});
}
const out=path.resolve(__dirname,'../diagnostics/execution-scale.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({synthetic:true,node:process.version,cpu:os.cpus()[0]?.model,results,limitations:'Engine-only timings; excludes SQLite audit writes, API transfer and browser rendering.'},null,2));console.log(JSON.stringify(results));
