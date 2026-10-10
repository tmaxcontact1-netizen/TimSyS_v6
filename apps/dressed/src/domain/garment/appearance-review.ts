import { z } from "zod";
import type { VisualFingerprint, PaletteEntry } from "./visual-fingerprint.js";

export const colours = ["unknown","black","white","grey","navy","blue","brown","beige","red","burgundy","green","yellow","orange","purple","pink"] as const;
export const cropSchema = z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().positive().max(1),height:z.number().positive().max(1)}).strict().refine(v=>v.x+v.width<=1.000001&&v.y+v.height<=1.000001,"Selection must stay inside the photograph");
export type Crop = z.infer<typeof cropSchema>;
export const appearanceSchema = z.object({
  primaryColour:z.enum(colours), secondaryColour:z.enum(colours).nullable(),
  lightness:z.enum(["unknown","dark","medium","light"]),
  saturation:z.enum(["unknown","muted","medium","vivid"]),
  pattern:z.enum(["unknown","solid","striped","checked","patterned"]),
  texture:z.enum(["unknown","smooth","textured"]),
}).strict();
export type Appearance = z.infer<typeof appearanceSchema>;
export const reviewSchema = z.object({
  version:z.number().int().positive(), analysisId:z.string().uuid().nullable(),
  name:z.string().trim().min(1).max(120),categoryId:z.string().uuid(),
  formality:z.number().int().min(1).max(5).nullable(),
  seasons:z.array(z.enum(["spring","summer","autumn","winter","all-season"])).max(5),
  useIds:z.array(z.string().uuid()).max(30), appearance:appearanceSchema,
}).strict().refine(v=>new Set(v.useIds).size===v.useIds.length&&new Set(v.seasons).size===v.seasons.length,"Uses and seasons must be unique");
export type AppearanceReview = z.infer<typeof reviewSchema>;

// Representative sRGB family colours, never a claim of measured fabric colour.
export const familyRGB:Record<string,readonly[number,number,number]>={unknown:[128,128,128],black:[20,20,20],white:[235,235,235],grey:[128,128,128],navy:[25,40,80],blue:[50,105,180],brown:[105,70,45],beige:[205,185,145],red:[175,45,45],burgundy:[95,25,40],green:[55,110,65],yellow:[220,190,55],orange:[210,115,40],purple:[105,65,135],pink:[215,135,155]};
export function rgbLab(rgb:readonly[number,number,number]):readonly[number,number,number]{
 const [r,g,b]=rgb.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}) as [number,number,number];
 const f=(v:number)=>v>.008856?Math.cbrt(v):7.787*v+16/116;
 const x=f((r*.4124+g*.3576+b*.1805)/.95047),y=f(r*.2126+g*.7152+b*.0722),z=f((r*.0193+g*.1192+b*.9505)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
export function reviewedFingerprint(appearance:Appearance,detected:VisualFingerprint|null,analysisId:string|null):VisualFingerprint{
 const names=[appearance.primaryColour,...(appearance.secondaryColour?[appearance.secondaryColour]:[])];
 const palette:PaletteEntry[]=names.map((name,index)=>({rgb:familyRGB[name]!,lab:rgbLab(familyRGB[name]!),label:name,proportion:names.length===1?1:index===0?.8:.2}));
 const uncertainFields=Object.entries(appearance).filter(([,v])=>v==="unknown").map(([k])=>k);
 return {schemaVersion:"1.0.0",algorithmVersion:"reviewed-card-free-1.0.0",whole:detected?.whole??null,detail:detected?.detail??null,
 combined:{palette,averageLightness:appearance.lightness==="dark"?25:appearance.lightness==="light"?80:50,averageChroma:appearance.saturation==="muted"?10:appearance.saturation==="vivid"?60:30,contrast:detected?.combined.contrast??0,
 patternDensity:appearance.pattern==="solid"?0:appearance.pattern==="unknown"?0:.15,textureStrength:appearance.texture==="textured"?.5:0,visualComplexity:appearance.pattern==="solid"?.1:appearance.pattern==="unknown"?0:.45,solidConfidence:appearance.pattern==="solid"?1:0},
 confidence:0,appearance:{...appearance,status:"reviewed",analysisId,uncertainFields,colourBasis:"representative-family"}};
}
