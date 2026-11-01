'use strict';
const {z}=require('zod');
const obj=p=>z.object(p).strict(),text=z.string().max(4000),id=z.string().uuid(),num=z.number().finite(),empty=obj({}),arr=(s,n=1000)=>z.array(s).max(n),grade=z.enum(['A','B','C']).nullable(),season=z.enum(['spring','summer','autumn','winter']).nullable().optional();
const ids=arr(id,20).min(2).refine(v=>new Set(v).size===v.length,'Garments must be unique');
const context=obj({id,slug:text,name:text,formalityMin:num,formalityMax:num});
const ruleSet=obj({id,name:text,version:text,thresholds:obj({a:num,b:num,c:num})});
const measurements=obj(Object.fromEntries(['spread','averageDeltaE','patternedItems','minimumPatternDifference','cumulativeComplexity','textureDifference','patternDensityDifference','bonus'].map(k=>[k,num.optional()])));
const outcome=obj({ruleId:text,domain:text,passed:z.boolean(),hardFailure:z.boolean(),scoreDelta:num,explanationCode:text,explanation:text,affectedGarmentIds:arr(id,20),measurements});
const evaluation=obj({eligible:z.boolean(),score:num,grade,...Object.fromEntries(['strengths','cautions','majorPenalties','hardFailures','outcomes'].map(k=>[k,arr(outcome,100)]))});
const garment=obj({id,name:text,slotId:text,imageId:id.nullable()}),candidate=obj({key:text,garments:arr(garment,20),evaluation});
const saved=obj({id,name:text,score:num,calculatedGrade:grade,userGrade:grade,favourite:z.boolean(),notes:text.nullable(),createdAt:text,contextName:text,items:arr(obj({id,name:text,slotId:text}),20)});
const shapes={
 catalogue:{input:empty,output:obj({ruleSet,contexts:arr(context)})},
 evaluate:{input:obj({garmentIds:ids,contextId:id,season}),output:obj({evaluationId:id,ruleSet,context,evaluation}),command:true},
 ensemble_catalogue:{input:obj({limit:z.number().int().min(1).max(200).default(200),offset:z.number().int().min(0).max(1000000).default(0)}),output:obj({contexts:arr(context),garments:arr(garment.extend({categorySlug:text,useIds:arr(id)}),200),saved:arr(saved,200),hasMore:z.boolean(),nextOffset:z.number().int()})},
 ensemble_generate:{input:obj({selectedGarmentId:id,contextId:id,useId:id,season,limitPerGrade:z.number().int().min(1).max(50).default(20)}),output:obj({a:arr(candidate,50),b:arr(candidate,50),c:arr(candidate,50),examined:z.number().int(),rejected:z.number().int()})},
 ensemble_save:{input:obj({name:z.string().trim().min(1).max(120),garmentIds:ids,contextId:id,useId:id,season,notes:z.string().trim().max(2000).nullable().optional()}),output:obj({id,name:text,score:num,grade}),command:true},
 ensemble_override:{input:obj({type:z.enum(['ban','favourite']),scope:z.enum(['exact_outfit','relationship']),garmentIds:ids,reason:z.string().trim().max(1000).nullable().optional()}),output:obj({id,type:z.enum(['ban','favourite']),scope:z.enum(['exact_outfit','relationship']),garmentIds:arr(id,20),reason:text.nullable(),timestamp:text}),command:true},
};
function schema(value){const s=z.toJSONSchema(value,{io:'input',unrepresentable:'any'});function clean(v){delete v.$schema;delete v.default;if(v.type==='object'){v.required||=[];v.additionalProperties=false;Object.values(v.properties||{}).forEach(clean);}if(v.type==='array'){v.maxItems??=1000;clean(v.items);}v.anyOf?.forEach(clean);return v;}return clean(s);}
module.exports={shapes,contract:{serviceId:'styling',version:'1.0.0',owner:'timsys',apps:['dressed'],operations:Object.fromEntries(Object.entries(shapes).map(([name,s])=>[name,{permission:s.command?'service:styling:write':'service:styling:read',effect:s.command?'command':'read',...(s.command?{idempotency:'required'}:{}),timeoutMs:25000,maximumInputBytes:32768,maximumOutputBytes:1048576,input:schema(s.input),output:schema(s.output)}]))}};
