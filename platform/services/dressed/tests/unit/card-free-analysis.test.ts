import { describe,it,expect } from "vitest";
import sharp from "sharp";
import { analyseCardFree } from "../../src/infrastructure/images/card-free-analysis.js";
import { appearanceSchema,cropSchema,reviewedFingerprint } from "../../src/domain/garment/appearance-review.js";
import { evaluateStyling } from "../../src/domain/outfit/styling-engine.js";

async function photo(flat=false){const pixels=Buffer.alloc(300*300*3,235);if(!flat)for(let y=30;y<270;y++)for(let x=100;x<200;x++){const p=(y*300+x)*3;pixels[p]=25;pixels[p+1]=40;pixels[p+2]=80;}return sharp(pixels,{raw:{width:300,height:300,channels:3}}).png().toBuffer();}
describe("card-free appearance review",()=>{
 it("detects without a card and keeps all correction choices explicit",async()=>{const result=await analyseCardFree(await photo(),null);expect(result.fingerprint).not.toBeNull();expect(result.appearance.primaryColour).toBe("navy");expect(result.appearance.texture).toBe("unknown");expect(result.findings.join(" ")).toContain("estimates");expect(result.region!.width).toBeLessThan(.5);});
 it("does not substitute background colour when detection fails",async()=>{const result=await analyseCardFree(await photo(true),null);expect(result.fingerprint).toBeNull();expect(result.appearance.primaryColour).toBe("unknown");expect(result.findings.join(" ")).toContain("manually");});
 it("allows in-app selection of a uniform garment when automatic separation fails",async()=>{const result=await analyseCardFree(await photo(true),{x:.2,y:.2,width:.6,height:.6});expect(result.fingerprint).not.toBeNull();expect(result.selection).toBe("manual");expect(result.appearance.primaryColour).toBe("white");});
 it("rejects selections outside the photograph",()=>{expect(cropSchema.safeParse({x:.8,y:0,width:.5,height:1}).success).toBe(false);});
 it("preserves manual unknowns and avoids numerical colour matching",()=>{const appearance=appearanceSchema.parse({primaryColour:"navy",secondaryColour:null,lightness:"dark",saturation:"muted",pattern:"unknown",texture:"unknown"});const fingerprint=reviewedFingerprint(appearance,null,null);const evaluation=evaluateStyling({garments:[{id:"g",name:"Navy shirt",categorySlug:"formal-shirts",status:"available",formality:null,seasons:[],fingerprintId:"f",fingerprint}],context:{id:"c",slug:"casual",name:"Casual",formalityMin:1,formalityMax:5}});expect(evaluation.outcomes.find(x=>x.ruleId==="colour.contrast")?.scoreDelta).toBe(0);expect(evaluation.outcomes.find(x=>x.ruleId==="appearance.uncertainty")?.explanation).toContain("pattern, texture, formality, season");});
});
