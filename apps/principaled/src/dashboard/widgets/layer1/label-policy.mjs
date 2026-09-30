// Camera-dependent presentation only; never influences geography or traversal.
export function labelPolicy({pixelsPerUnit=0,focused=false,smallScope=false}={}){
 const detail=focused?'focused':smallScope||pixelsPerUnit>=.9?'close':pixelsPerUnit>=.35?'intermediate':'global';
 return {detail,orientationOpacity:detail==='global'?.85:detail==='intermediate'?.55:.38,orientationScale:detail==='global'?1:detail==='intermediate'?.95:.9,hideDomains:detail==='close'||detail==='focused',planeOpacity:detail==='global'?.65:detail==='intermediate'?.35:.12};
}
export function labelPriority(kind,selected=false){return selected?0:({node:1,edge:2,family:3,guide:5,level:5}[kind]??4);}
