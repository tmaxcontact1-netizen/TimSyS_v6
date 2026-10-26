import {expect,test} from "vitest";
import {reviewedFingerprint, type Appearance} from "../../src/domain/garment/appearance-review.js";
import {generateEnsembles,type SlottedGarment} from "../../src/domain/outfit/ensemble-engine.js";
import {evaluateStyling} from "../../src/domain/outfit/styling-engine.js";
import {selectedRequirements} from "../../src/domain/outfit/selected-slots.js";
const context={id:"context",slug:"smart-casual",name:"Smart casual",formalityMin:2,formalityMax:4};
const requirements=["top","bottom","footwear"].map(slotId=>({slotId,requirement:"required" as const,minimumItems:1,maximumItems:1}));
function garment(id:string,slotId:string,colour:Appearance["primaryColour"],pattern:Appearance["pattern"]="solid"):SlottedGarment{return {id,name:id,slotId,categorySlug:slotId,status:"available",formality:null,seasons:[],fingerprintId:id,imageId:id,fingerprint:reviewedFingerprint({primaryColour:colour,secondaryColour:null,lightness:"unknown",saturation:"unknown",pattern,texture:"unknown"},null,null)}}
const available=[garment("shirt","top","white"),garment("chinos","bottom","navy"),garment("tie","neckwear","red","patterned")];
test("selected categories are mandatory, unselected categories excluded, anchor retained",()=>{
 const input={selected:available[0]!,available,context,parameters:{},thresholds:{a:85,b:72,c:60}};
 const requirements=selectedRequirements(["bottom","bottom"],"top");
 expect(requirements.map(r=>r.slotId)).toEqual(["bottom","top"]);
 const result=generateEnsembles({...input,requirements});
 const candidates=[...result.a,...result.b,...result.c];expect(candidates.length).toBeGreaterThan(0);
 for(const c of candidates)expect(c.garments.map(g=>g.slotId).sort()).toEqual(["bottom","top"]);
 const missing=generateEnsembles({...input,requirements:selectedRequirements(["bottom","footwear"],"top")});
 expect([...missing.a,...missing.b,...missing.c]).toHaveLength(0);
 const withTie=generateEnsembles({...input,requirements:selectedRequirements(["bottom","neckwear"],"top")});
 for(const c of [...withTie.a,...withTie.b,...withTie.c])expect(c.garments.some(g=>g.id==="tie")).toBe(true);
});
test("incomplete combinations are opt-in, retain the anchor and never invent footwear",()=>{
 const input={selected:available[2]!,available,requirements,context,parameters:{},thresholds:{a:85,b:72,c:60}};
 const strict=generateEnsembles(input);expect([...strict.a,...strict.b,...strict.c]).toHaveLength(0);
 const partial=generateEnsembles({...input,allowIncomplete:true});const candidates=[...partial.a,...partial.b,...partial.c];expect(candidates.length).toBeGreaterThan(0);
 for(const c of candidates){expect(c.garments.map(g=>g.id)).toEqual(expect.arrayContaining(["shirt","chinos","tie"]));expect(c.garments.some(g=>g.slotId==="footwear")).toBe(false)}
 expect(generateEnsembles({...input,available:[available[2]!],allowIncomplete:true}).b).toHaveLength(0);
});
test("confirmed colour and pattern fields affect ranking without pretending exact measurements",()=>{
 const restrained=evaluateStyling({garments:available,context});
 const busy=evaluateStyling({garments:[garment("shirt","top","green","checked"),garment("chinos","bottom","purple","striped"),available[2]!],context});
 expect(restrained.score).toBeGreaterThan(busy.score);
 expect(restrained.outcomes.find(o=>o.ruleId==="colour.reviewed_families")?.measurements.colours).toEqual(["white","navy","red"]);
 expect(restrained.outcomes.find(o=>o.ruleId==="colour.contrast")?.scoreDelta).toBe(0);
 expect(restrained.outcomes.find(o=>o.ruleId==="pattern.scale")?.scoreDelta).toBe(0);
 expect(restrained.outcomes.find(o=>o.ruleId==="context.formality")?.explanationCode).toBe("appearance_not_precisely_measured");
});

test("shortlists preserve different ties without changing scores or replacing a tie anchor",()=>{
 const shirt=garment("shirt","top","white"),bottom=garment("bottom","bottom","navy"),shoe=garment("shoe","footwear","black");
 const ties=[garment("tie-red","neckwear","red"),garment("tie-blue","neckwear","blue"),garment("tie-purple","neckwear","purple"),garment("tie-grey","neckwear","grey")];
 const available=[shirt,bottom,shoe,...ties];
 const input={selected:shirt,available,requirements:selectedRequirements(["top","bottom","footwear","neckwear"],"top"),context,parameters:{},thresholds:{a:85,b:72,c:60},limitPerGrade:12};
 const result=generateEnsembles(input),outfits=[...result.a,...result.b,...result.c];
 expect(new Set(outfits.map(o=>o.garments.find(g=>g.slotId==="neckwear")!.id)).size).toBeGreaterThan(2);
 for(const o of outfits)expect(o.evaluation.score).toBe(evaluateStyling({garments:o.garments,context}).score);
 const anchored=generateEnsembles({...input,selected:ties[0]!});
 for(const o of [...anchored.a,...anchored.b,...anchored.c])expect(o.garments.filter(g=>g.slotId==="neckwear").map(g=>g.id)).toEqual([ties[0]!.id]);
});

test("tie-square shortlists show distinct pairs and preserve both accessories",()=>{
 const shirt=garment("shirt","top","white"),bottom=garment("bottom","bottom","navy"),shoe=garment("shoe","footwear","black"),jacket=garment("jacket","jacket","navy");
 const ties=[garment("red-tie","neckwear","red"),garment("blue-tie","neckwear","blue"),garment("purple-tie","neckwear","purple"),garment("grey-tie","neckwear","grey")];
 const squares=[garment("white-square","pocket_square","white"),garment("pink-square","pocket_square","pink"),garment("blue-square","pocket_square","blue"),garment("red-square","pocket_square","red")];
 const available=[shirt,bottom,shoe,jacket,...ties,...squares];
 const result=generateEnsembles({selected:shirt,available,requirements:selectedRequirements(["top","bottom","footwear","jacket","neckwear","pocket_square"],"top"),context,parameters:{},thresholds:{a:85,b:72,c:60},limitPerGrade:12});
 const outfits=[...result.a,...result.b,...result.c];
 const pairs=outfits.map(o=>o.garments.filter(g=>["neckwear","pocket_square"].includes(g.slotId)).map(g=>g.id).sort().join(":"));
 expect(new Set(pairs).size).toBe(outfits.length);
 for(const slot of ["neckwear","pocket_square"]){const ids=outfits.map(o=>o.garments.find(g=>g.slotId===slot)!.id);expect(new Set(ids).size).toBeGreaterThan(2);for(const id of ids)expect(ids.filter(x=>x===id).length).toBeLessThanOrEqual(2);}
});

test("partial outfits retain four fixed garments and vary only requested accessories",()=>{
 const fixed=[garment("shirt","top","white"),garment("bottom","bottom","navy"),garment("shoe","footwear","brown"),garment("jacket","jacket","navy")];
 const ties=[garment("red-tie","neckwear","red"),garment("blue-tie","neckwear","blue"),garment("purple-tie","neckwear","purple"),garment("grey-tie","neckwear","grey")];
 const squares=[garment("white-square","pocket_square","white"),garment("pink-square","pocket_square","pink"),garment("blue-square","pocket_square","blue"),garment("red-square","pocket_square","red")];
 const available=[...fixed,...ties,...squares,garment("alternative-shirt","top","blue"),garment("extra-belt","belt","brown")];
 const input={selected:fixed[0]!,fixed,available,requirements:selectedRequirements(["neckwear","pocket_square"],"top"),context,parameters:{},thresholds:{a:85,b:72,c:60},limitPerGrade:12};
 const result=generateEnsembles(input),outfits=[...result.a,...result.b,...result.c];
 expect(outfits.length).toBeGreaterThan(2);
 for(const outfit of outfits){expect(outfit.garments.map(g=>g.id)).toEqual(expect.arrayContaining(fixed.map(g=>g.id)));expect(outfit.garments).toHaveLength(6);expect(new Set(outfit.garments.map(g=>g.slotId)).size).toBe(6);}
 for(const slot of ["neckwear","pocket_square"])expect(new Set(outfits.map(o=>o.garments.find(g=>g.slotId===slot)!.id)).size).toBeGreaterThan(2);
 const tied=generateEnsembles({...input,fixed:[...fixed,ties[0]!]});const tiedOutfits=[...tied.a,...tied.b,...tied.c];expect(tiedOutfits.length).toBeGreaterThan(2);for(const o of tiedOutfits)expect(o.garments.find(g=>g.slotId==="neckwear")?.id).toBe(ties[0]!.id);
 expect(()=>generateEnsembles({...input,fixed:[...fixed,garment("second-shirt","top","blue")]})).toThrow("one fixed garment");
 const missing=generateEnsembles({...input,available:available.filter(g=>g.slotId!=="pocket_square")});expect([...missing.a,...missing.b,...missing.c]).toHaveLength(0);
});

test("fixing both tie and square does not cap all other recommendations to one",()=>{
 const fixed=[garment("shirt","top","white"),garment("jacket","jacket","navy"),garment("tie","neckwear","blue"),garment("square","pocket_square","white")];
 const available=[...fixed,garment("navy-bottom","bottom","navy"),garment("grey-bottom","bottom","grey"),garment("beige-bottom","bottom","beige")];
 const result=generateEnsembles({selected:fixed[0]!,fixed,available,requirements:selectedRequirements(["bottom"],"top"),context,parameters:{},thresholds:{a:85,b:72,c:60}});
 const outfits=[...result.a,...result.b,...result.c];expect(outfits.length).toBeGreaterThan(1);for(const o of outfits)expect(o.garments.map(g=>g.id)).toEqual(expect.arrayContaining(fixed.map(g=>g.id)));
});
