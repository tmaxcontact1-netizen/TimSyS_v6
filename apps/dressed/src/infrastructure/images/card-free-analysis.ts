import sharp from "sharp";
import { familyRGB,rgbLab,type Appearance,type Crop } from "../../domain/garment/appearance-review.js";
import type { ImageMeasurements,VisualFingerprint } from "../../domain/garment/visual-fingerprint.js";
import { combineFingerprint } from "./visual-fingerprint-engine.js";

export interface AnalysisResult { fingerprint:VisualFingerprint|null; appearance:Appearance; suggestedCategory:string|null; findings:string[]; region:Crop|null; selection:"automatic"|"manual"; }
const unknown:Appearance={primaryColour:"unknown",secondaryColour:null,lightness:"unknown",saturation:"unknown",pattern:"unknown",texture:"unknown"};
export async function analyseCardFree(bytes:Buffer,crop:Crop|null):Promise<AnalysisResult>{
 // Decode/orient in memory; original bytes are never replaced. Convert tagged input to sRGB.
 const oriented=await sharp(bytes,{limitInputPixels:100_000_000}).rotate().toColourspace("srgb").removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:ow,height:oh,channels}=oriented.info;
 let pipeline=sharp(oriented.data,{raw:{width:ow,height:oh,channels}});
 if(crop){const left=Math.min(ow-1,Math.floor(crop.x*ow)),top=Math.min(oh-1,Math.floor(crop.y*oh));pipeline=pipeline.extract({left,top,width:Math.max(1,Math.min(ow-left,Math.round(crop.width*ow))),height:Math.max(1,Math.min(oh-top,Math.round(crop.height*oh)))});}
 const {data,info}=await pipeline.resize({width:320,height:320,fit:"inside",withoutEnlargement:true}).raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,n=w*h,c=info.channels;
 const borders:number[][]=[[],[],[]];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<3||y<3||x>=w-3||y>=h-3)for(let k=0;k<3;k++)borders[k]!.push(data[(y*w+x)*c+k]!);
 const bg=borders.map(a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)]??0);
 const mask=new Uint8Array(n),lum=new Float64Array(n),bins=new Map<string,{count:number;rgb:number[]}>();
 let count=0,minX=w,minY=h,maxX=-1,maxY=-1,sum=0,sum2=0,clipped=0,light=0,chroma=0;
 for(let p=0;p<n;p++){
  const rgb=[data[p*c]!,data[p*c+1]!,data[p*c+2]!] as [number,number,number];
  lum[p]=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  if(!crop&&Math.hypot(rgb[0]-bg[0]!,rgb[1]-bg[1]!,rgb[2]-bg[2]!)<30)continue;
  mask[p]=1;count++;minX=Math.min(minX,p%w);maxX=Math.max(maxX,p%w);minY=Math.min(minY,Math.floor(p/w));maxY=Math.max(maxY,Math.floor(p/w));
  const l=lum[p]!;sum+=l;sum2+=l*l;if(rgb.every(v=>v>248)||rgb.every(v=>v<5))clipped++;
  const lab=rgbLab(rgb);light+=lab[0];chroma+=Math.hypot(lab[1],lab[2]);
  const key=rgb.map(v=>v>>5).join("-");const bin=bins.get(key)??{count:0,rgb:[0,0,0]};bin.count++;for(let k=0;k<3;k++)bin.rgb[k]!+=rgb[k]!;bins.set(key,bin);
 }
 const findings=["Photo colours are estimates, not calibrated measurements. Confirm the colours against the garment."];
 const region=maxX<0?null:crop??{x:minX/w,y:minY/h,width:(maxX-minX+1)/w,height:(maxY-minY+1)/h};
 if(count<64||(!crop&&count/n<.02))return{fingerprint:null,appearance:{...unknown},suggestedCategory:null,findings:[...findings,"The garment could not be separated from its background. Select the garment area, enter details manually, or upload a photograph with a contrasting background."],region,selection:crop?"manual":"automatic"};
 if(clipped/count>.2)findings.push("Strong highlights or deep shadows may hide colour and detail. Review manually or photograph in even light.");
 if(Math.min(w,h)<80)findings.push("The selected area contains little image detail. Use a wider selection or another photograph if suggestions are unclear.");
 let edges=0,neighbours=0,difference=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x;if(!mask[p]||!mask[p-1]||!mask[p+1]||!mask[p-w]||!mask[p+w])continue;neighbours++;const gx=lum[p+1]!-lum[p-1]!,gy=lum[p+w]!-lum[p-w]!;if(Math.hypot(gx,gy)>36)edges++;difference+=Math.abs(lum[p]!-lum[p-1]!)+Math.abs(lum[p]!-lum[p-w]!);}
 const palette=[...bins.values()].sort((a,b)=>b.count-a.count).slice(0,5).map(bin=>{const rgb=bin.rgb.map(v=>Math.round(v/bin.count)) as [number,number,number];const lab=rgbLab(rgb);let label="unknown",distance=Infinity;for(const [name,family] of Object.entries(familyRGB)){if(name==="unknown")continue;const target=rgbLab(family),d=Math.hypot(...lab.map((v,i)=>v-target[i]!));if(d<distance){distance=d;label=name;}}return{rgb,lab,label,proportion:bin.count/count};});
 const density=edges/Math.max(neighbours,1),texture=Math.min(1,difference/Math.max(neighbours*2,1)/32),contrast=Math.min(1,Math.sqrt(Math.max(0,sum2/count-(sum/count)**2))/64);
 const solid=Math.max(0,1-density*3-Math.min(1,(bins.size-1)/40)*.45);
 const complexity=Math.min(1,.4*density*4+.3*texture+.3*contrast);
 const measurements:ImageMeasurements={width:w,height:h,foregroundCoverage:count/n,foregroundAspectRatio:(maxX-minX+1)/(maxY-minY+1),palette,averageLightness:light/count,averageChroma:chroma/count,luminanceContrast:contrast,edgeDensity:density,horizontalEdgeEnergy:0,verticalEdgeEnergy:0,textureStrength:texture,paletteComplexity:Math.min(1,(bins.size-1)/40),visualComplexity:complexity,solidConfidence:solid};
 const first=palette[0]!,secondary=palette.find(p=>p.label!==first.label&&p.proportion>.12)?.label??null;
 const appearance:Appearance={primaryColour:first.label as Appearance["primaryColour"],secondaryColour:secondary as Appearance["secondaryColour"],lightness:light/count<35?"dark":light/count>70?"light":"medium",saturation:chroma/count<18?"muted":chroma/count>45?"vivid":"medium",pattern:solid>.8?"solid":"unknown",texture:"unknown"};
 findings.push("Category is a shape-only suggestion. Formality, season, use and texture need your judgement.");
 if(appearance.pattern==="unknown")findings.push("Pattern could not be identified reliably. Select the pattern manually, or add a clearer close-up.");
 const ratio=measurements.foregroundAspectRatio;
 return{fingerprint:{...combineFingerprint(measurements,null),algorithmVersion:"card-free-1.0.0"},appearance,suggestedCategory:ratio<.32?"ties":ratio>3?"formal-belts":ratio<.72?"formal-shirts":"casual-shirts",findings,region,selection:crop?"manual":"automatic"};
}
