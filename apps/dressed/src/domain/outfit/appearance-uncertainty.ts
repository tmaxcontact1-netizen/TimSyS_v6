import type { RuleOutcome,StylingGarment } from "./styling-engine.js";

export function applyAppearanceUncertainty(garments:readonly StylingGarment[],outcomes:RuleOutcome[],season?:string):void{
 const reviewed=garments.filter(g=>g.fingerprint?.appearance);
 if(!reviewed.length)return;
 const knownColours=reviewed.map(g=>g.fingerprint!.appearance!.primaryColour).filter(c=>c!=="unknown");
 const neutrals=new Set(["black","white","grey","navy","beige","brown"]);
 const accents=[...new Set(knownColours.filter(c=>!neutrals.has(c)))];
 if(knownColours.length===garments.length){
  const controlled=accents.length<=2;
  outcomes.push({ruleId:"colour.reviewed_families",domain:"colour",passed:controlled,hardFailure:false,scoreDelta:controlled?4:-4,explanationCode:"reviewed_colour_families",explanation:controlled?`Your confirmed colour families form a restrained palette (${[...new Set(knownColours)].join(", ")}). This is a broad coordination suggestion, not an exact shade match.`:`Your confirmed colours include ${accents.length} accent families (${accents.join(", ")}); check that they work together in person.`,affectedGarmentIds:garments.map(g=>g.id),measurements:{basis:"reviewed-colour-families",colours:knownColours,accentFamilies:accents}});
 }
 const knownPatterns=reviewed.filter(g=>g.fingerprint!.appearance!.pattern!=="unknown");
 if(knownPatterns.length===garments.length){
  const active=knownPatterns.filter(g=>g.fingerprint!.appearance!.pattern!=="solid");
  outcomes.push({ruleId:"pattern.reviewed_types",domain:"pattern",passed:active.length<=2,hardFailure:false,scoreDelta:active.length<=1?3:active.length===2?0:-4,explanationCode:"reviewed_pattern_types",explanation:active.length<=1?"Your confirmed patterns leave one or no patterned focal items against solid garments.":`${active.length} items have confirmed patterns; compare their scale in person before wearing.`,affectedGarmentIds:active.map(g=>g.id),measurements:{basis:"reviewed-pattern-types",patterns:knownPatterns.map(g=>g.fingerprint!.appearance!.pattern)}});
 }
 const unmeasured=new Set(["colour.contrast","pattern.scale","tie_square.duplication","ensemble.complexity","texture.balance"]);
 if(reviewed.some(g=>g.fingerprint!.appearance!.texture==="unknown"))unmeasured.add("texture.balance");
 if(reviewed.some(g=>g.fingerprint!.appearance!.pattern==="unknown"))unmeasured.add("ensemble.complexity");
 if(garments.some(g=>g.formality===null))unmeasured.add("formality.coherence");
 if(garments.some(g=>g.formality===null)&&!outcomes.some(o=>o.ruleId==="context.formality"&&o.hardFailure))unmeasured.add("context.formality");
 if(season&&garments.some(g=>!g.seasons.length))unmeasured.add("season.suitability");
 for(let i=0;i<outcomes.length;i++)if(unmeasured.has(outcomes[i]!.ruleId)){
  const current=outcomes[i]!;
  outcomes[i]={...current,passed:false,hardFailure:false,scoreDelta:0,explanationCode:"appearance_not_precisely_measured",explanation:`${current.domain === "colour" ? "Exact colour matching" : current.ruleId === "pattern.scale" ? "Pattern scale matching" : current.ruleId === "tie_square.duplication" ? "Exact tie and pocket-square matching" : current.domain} is not scored because the available appearance information is approximate or incomplete.`,measurements:{basis:"reviewed-colour-families"}};
 }
 for(const garment of reviewed){
  const appearance=garment.fingerprint!.appearance!;
  const fields=[...appearance.uncertainFields,...(garment.formality===null?["formality"]:[]),...(!garment.seasons.length?["season"]:[])];
  const names:Record<string,string>={primaryColour:"primary colour",secondaryColour:"secondary colour",lightness:"lightness",saturation:"colour intensity",pattern:"pattern",texture:"texture",formality:"formality",season:"season"};
  outcomes.push({ruleId:"appearance.uncertainty",domain:"ensemble",passed:false,hardFailure:false,scoreDelta:0,explanationCode:"reviewed_appearance_estimate",explanation:`${garment.name}: reviewed colour families are used; exact shades are unmeasured.${fields.length?` Uncertain: ${fields.map(f=>names[f]??f).join(", ")}. Check before wearing.`:" Appearance details were confirmed by you; fine colour and pattern-scale matching remain unmeasured."}`,affectedGarmentIds:[garment.id],measurements:{uncertainFields:fields,basis:appearance.colourBasis}});
 }
}
