import {createHash} from 'node:crypto';
import config from '../../analysis-config/mcf-deterministic/1.0.json' with {type:'json'};
export const DETERMINISTIC_CONFIG=config;
export const DETERMINISTIC_HASH=createHash('sha256').update(JSON.stringify(config)).digest('hex');
export function deterministicMcf(units:{id:string;original_text:string}[],rules=config.rules){
 return units.map(unit=>({unitId:unit.id,method:'deterministic',codes:[],valence:null,reviewedNoCode:false,
  notes:'Local rule matching only. Context, negation, evidence strength and valence have not been interpreted. No match is not evidence of absence.',
  matches:rules.flatMap(rule=>{const found=new RegExp(rule.pattern,'iu').exec(unit.original_text);return found?[{
   competencyId:rule.competencyId,ruleId:`${config.id}@${config.version}:${rule.competencyId}`,
   matchedText:found[0],start:found.index,end:found.index+found[0].length,evidence:unit.original_text,
   rationale:`The passage matches the versioned retrieval rule for this competency: “${found[0]}”. This is a candidate passage, not a confirmed competency judgement.`
  }]:[];})
 }));
}
