import {expect,test} from "vitest";
import {reviewedFingerprint,type Appearance} from "../../src/domain/garment/appearance-review.js";
import {evaluateStyling,type StylingGarment} from "../../src/domain/outfit/styling-engine.js";
import {coordinationProfile} from "../../src/domain/outfit/coordination.js";
const work={id:"work",slug:"business",name:"Business",formalityMin:3,formalityMax:4};
const casual={id:"casual",slug:"casual",name:"Casual",formalityMin:1,formalityMax:2};
function garment(id:string,slotId:string,colour:Appearance["primaryColour"],pattern:Appearance["pattern"]="solid",secondary:Appearance["secondaryColour"]=null,notes=""):StylingGarment{return {id,name:id,slotId,categorySlug:slotId,status:"available",formality:null,seasons:[],notes,fingerprintId:id,fingerprint:reviewedFingerprint({primaryColour:colour,secondaryColour:secondary,lightness:"unknown",saturation:"unknown",pattern,texture:"unknown"},null,null)}}
const shirt=garment("White shirt","top","white");
const chinos=garment("Navy chinos","bottom","navy");
const evaluate=(items:StylingGarment[],context=work)=>evaluateStyling({garments:items,context});
test("confirmed pattern accent changes coordination without changing its ground colour",()=>{
 const tie=garment("Tie","neckwear","blue","patterned","pink");
 const echoed=garment("Square","pocket_square","white","patterned","pink");
 const unrelated=garment("Square","pocket_square","white","patterned","orange");
 expect(evaluate([shirt,chinos,tie,echoed]).score).toBeGreaterThan(evaluate([shirt,chinos,tie,unrelated]).score);
});
test("same motifs with unknown scale carry a visible caution, known separated scales fare better",()=>{
 const small=garment("Shirt","top","blue","checked",null,"Owner description: small blue check.");
 const large=garment("Jacket","jacket","grey","checked",null,"Owner description: large grey check.");
 const unknown={...large,notes:""};
 expect(evaluate([small,large]).score).toBeGreaterThan(evaluate([small,unknown]).score);
 expect(evaluate([small,unknown]).cautions.some(o=>o.ruleId==="pattern.relationship"&&o.explanation.includes("unconfirmed"))).toBe(true);
});
test("business and casual rank dress shoes and trainers differently even with missing formality elsewhere",()=>{
 const dress={...garment("Black Derby shoes","footwear","black"),formality:4};
 const trainers={...garment("Black trainers","footwear","black"),formality:1};
 expect(evaluate([shirt,chinos,dress]).score).toBeGreaterThan(evaluate([shirt,chinos,trainers]).score);
 expect(evaluate([shirt,chinos,trainers],casual).score).toBeGreaterThan(evaluate([shirt,chinos,dress],casual).score);
 expect(evaluate([shirt,chinos,dress]).cautions.some(o=>o.ruleId==="coordination.style_uncertainty")).toBe(true);
});
test("matching belt and shoe families outrank black and brown mixing",()=>{
 const shoes=garment("Brown Derby shoes","footwear","brown");
 expect(evaluate([shirt,shoes,garment("Brown leather belt","belt","brown")]).score).toBeGreaterThan(evaluate([shirt,shoes,garment("Black leather belt","belt","black")]).score);
});
test("uncertain owner descriptions are surfaced, and never promote guessed colours",()=>{
 const g=garment("Square","pocket_square","blue","striped","unknown","Owner description: blue with maybe maroon and grey stripes.");
 expect(coordinationProfile(g).colours).toEqual(["blue"]);
 expect(evaluate([shirt,g]).cautions.some(o=>o.ruleId==="coordination.description_uncertainty")).toBe(true);
});
test("unambiguous owner accents are used; structured solid review overrides old pattern text",()=>{
 const g=garment("Square","pocket_square","grey","striped","pink","Owner description: grey with pink, black and white stripes.");
 expect(coordinationProfile(g).colours).toContain("white");
 const solid={...g,fingerprint:reviewedFingerprint({primaryColour:"green",secondaryColour:null,lightness:"unknown",saturation:"unknown",pattern:"solid",texture:"unknown"},null,null)};
 expect(coordinationProfile(solid).colours).toEqual(["green"]);
});
test("reviewed fingerprints never earn synthetic measured complexity rewards",()=>{
 expect(evaluate([shirt,chinos]).outcomes.find(o=>o.ruleId==="ensemble.complexity")?.scoreDelta).toBe(0);
 expect(evaluate([shirt,chinos]).cautions.some(o=>o.ruleId==="appearance.uncertainty")).toBe(true);
});

test("unknown colours never earn palette or accessory matching rewards",()=>{
 const belt=garment("Unknown belt","belt","unknown");
 const shoes=garment("Unknown shoes","footwear","unknown");
 const result=evaluate([shirt,belt,shoes]);
 expect(result.outcomes.find(o=>o.ruleId==="colour.relationships")?.scoreDelta).toBe(0);
 expect(result.cautions.some(o=>o.ruleId==="colour.relationships")).toBe(true);
 expect(result.outcomes.some(o=>o.ruleId==="accessories.belt_shoes"&&o.scoreDelta>0)).toBe(false);
});
