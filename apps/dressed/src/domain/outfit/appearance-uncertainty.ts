import type { RuleOutcome,StylingGarment } from "./styling-engine.js";

export function applyAppearanceUncertainty(garments:readonly StylingGarment[],outcomes:RuleOutcome[],season?:string):void{
 const reviewed=garments.filter(g=>g.fingerprint?.appearance);
 if(!reviewed.length)return;
 const unmeasured=new Set(["colour.contrast","pattern.scale","tie_square.duplication"]);
 if(reviewed.some(g=>g.fingerprint!.appearance!.texture==="unknown"))unmeasured.add("texture.balance");
 if(reviewed.some(g=>g.fingerprint!.appearance!.pattern==="unknown"))unmeasured.add("ensemble.complexity");
 if(garments.some(g=>g.formality===null))unmeasured.add("formality.coherence");
 if(season&&garments.some(g=>!g.seasons.length))unmeasured.add("season.suitability");
 for(let i=0;i<outcomes.length;i++)if(unmeasured.has(outcomes[i]!.ruleId)){
  const current=outcomes[i]!;
  outcomes[i]={...current,passed:false,hardFailure:false,scoreDelta:0,explanationCode:"appearance_not_precisely_measured",explanation:`${current.domain === "colour" ? "Exact colour matching" : current.ruleId === "pattern.scale" ? "Pattern scale matching" : current.ruleId === "tie_square.duplication" ? "Exact tie and pocket-square matching" : current.domain} is not scored because the available appearance information is approximate or incomplete.`,measurements:{basis:"reviewed-colour-families"}};
 }
 for(const garment of reviewed){
  const appearance=garment.fingerprint!.appearance!;
  const fields=[...appearance.uncertainFields,...(garment.formality===null?["formality"]:[]),...(!garment.seasons.length?["season"]:[])];
  const names:Record<string,string>={primaryColour:"primary colour",secondaryColour:"secondary colour",lightness:"lightness",saturation:"colour intensity",pattern:"pattern",texture:"texture",formality:"formality",season:"season"};
  outcomes.push({ruleId:"appearance.uncertainty",domain:"ensemble",passed:false,hardFailure:false,scoreDelta:0,explanationCode:"reviewed_appearance_estimate",explanation:`${garment.name}: colours are approximate.${fields.length?` Uncertain: ${fields.map(f=>names[f]??f).join(", ")}. Check before wearing.`:" Appearance details were confirmed by you; fine colour and pattern-scale matching remain unmeasured."}`,affectedGarmentIds:[garment.id],measurements:{uncertainFields:fields,basis:appearance.colourBasis}});
 }
}
