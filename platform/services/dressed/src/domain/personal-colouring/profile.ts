import {z} from 'zod';
const choice=(values:readonly [string,...string[]])=>z.enum(values);
export const personalColouringSchema=z.object({
 enabled:z.boolean(),depth:choice(['unknown','light','medium','deep']),undertone:choice(['unknown','warm','cool','neutral','olive']),contrast:choice(['unknown','low','medium','high']),intensity:choice(['unknown','muted','medium','vivid']),
 mannequinColour:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
 confirmed:z.boolean(),notes:z.string().max(2000),
 samples:z.array(z.object({depth:choice(['unknown','light','medium','deep']),contrast:choice(['unknown','low','medium','high']),warnings:z.array(z.string().max(300)).max(10)}).strict()).max(5),
 feedback:z.array(z.object({garmentId:z.string().uuid(),result:choice(['works','washes-out','unsure']),notes:z.string().max(500)}).strict()).max(200)
}).strict();
export type ColouringProfile=z.infer<typeof personalColouringSchema>;
export const emptyColouringProfile:ColouringProfile={enabled:false,depth:'unknown',undertone:'unknown',contrast:'unknown',intensity:'unknown',confirmed:false,notes:'',samples:[],feedback:[]};
export type PixelSample={lightness:number;clipped:number;spread:number};
// Relative luminance of the chosen pixels, not a skin pigmentation measurement.
export function samplePixels(pixels:ArrayLike<number>):PixelSample{
 const light:number[]=[];let clipped=0;
 for(let i=0;i+3<pixels.length;i+=4){const channels=[pixels[i]!,pixels[i+1]!,pixels[i+2]!];if(channels.some(c=>c>=250)||channels.every(c=>c<=5))clipped++;const [r,g,b]=channels.map(c=>{const v=c/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});const y=.2126*r!+.7152*g!+.0722*b!;light.push(y>.008856?116*Math.cbrt(y)-16:903.3*y);}
 if(!light.length)throw Error('Select a larger area.');light.sort((a,b)=>a-b);return {lightness:light[Math.floor(light.length/2)]!,clipped:clipped/light.length,spread:light[Math.floor(light.length*.9)]!-light[Math.floor(light.length*.1)]!};
}
export function analyseSamples(samples:Partial<Record<'skinLeft'|'skinRight'|'hair'|'eyes',PixelSample>>){
 const warnings:string[]=[];const skin=[samples.skinLeft,samples.skinRight].filter((s):s is PixelSample=>!!s);
 if(skin.length<2)warnings.push('Select two evenly lit skin areas to check for uneven lighting.');
 if(skin.length===2&&Math.abs(skin[0]!.lightness-skin[1]!.lightness)>12)warnings.push('The two skin areas differ substantially. Try a new photo in even daylight.');
 if(Object.values(samples).some(s=>s&&(s.clipped>.05||s.spread>35)))warnings.push('A selected area contains glare, deep shadow or mixed surfaces. Adjust the crop or try another photo.');
 const reliable=skin.length===2&&warnings.length===0;
 const l=skin.length?skin.reduce((sum,s)=>sum+s.lightness,0)/skin.length:0;
 const features=[samples.hair,samples.eyes].filter((s):s is PixelSample=>!!s);
 const difference=features.length?Math.max(...features.map(s=>Math.abs(s.lightness-l))):0;
 return {depth:reliable?(l<42?'deep':l>68?'light':'medium'):'unknown',contrast:reliable&&features.length===2?(difference<20?'low':difference>40?'high':'medium'):'unknown',warnings:[...warnings,...(features.length<2?['Select hair (or beard) and iris areas to estimate facial contrast; otherwise enter it manually.']:[])]};
}
const nearFace=new Set(['top','jacket','outerwear','neckwear','scarf','headwear','waistcoat']);
export type ColouringGarment={id:string;name:string;slotId?:string;appearance?:{primaryColour?:string;lightness?:string;saturation?:string}|null};
export function personalColouringAdvice(profile:ColouringProfile,garments:readonly ColouringGarment[]){
 if(!profile.enabled)return {confidence:'Not enabled',items:[] as string[],warnings:[] as string[]};
 const relevant=garments.filter(g=>nearFace.has(g.slotId??''));const items:string[]=[],warnings:string[]=[];
 const warn=(message:string)=>{warnings.push(message);items.push(message);};
 for(const g of relevant){const feedback=profile.feedback.find(f=>f.garmentId===g.id);if(feedback?.result==='washes-out')warn(`${g.name}: you recorded that this washes you out. Try a different piece near your face, or separate it from your face with a shirt, scarf or tie you know works.${feedback.notes?' Your note: '+feedback.notes:''}`);else if(feedback?.result==='works')items.push(`${g.name}: you recorded that this works for you.${feedback.notes?' Your note: '+feedback.notes:''}`);}
 const untested=relevant.filter(g=>!profile.feedback.some(f=>f.garmentId===g.id&&f.result!=='unsure'));
 const unknown=untested.filter(g=>!g.appearance||g.appearance.lightness==='unknown'||!g.appearance.lightness);
 if(unknown.length)items.push(`Lightness is unconfirmed for ${unknown.map(g=>g.name).join(', ')}. Confirm it in the garment editor before judging contrast near your face.`);
 const known=untested.filter(g=>g.appearance?.lightness&&g.appearance.lightness!=='unknown');
 if(profile.contrast==='high'&&known.length&&new Set(known.map(g=>g.appearance!.lightness)).size===1)warn('Your profile calls for stronger light–dark contrast, but the known pieces near your face are similar in lightness. Try a lighter shirt with a darker jacket or tie, then compare in daylight.');
 if(profile.contrast==='low'&&known.some(g=>g.appearance!.lightness==='light')&&known.some(g=>g.appearance!.lightness==='dark'))warn('This creates a strong light–dark contrast near your face. If it feels overpowering against your lower-contrast colouring, try a medium-toned shirt or softer neckwear.');
 if(profile.intensity==='muted'&&untested.some(g=>g.appearance?.saturation==='vivid'))warn('A vivid piece near your face may draw attention away from you. Compare it with a softer version; keep it if you prefer the stronger effect.');
 if(profile.depth==='light'&&known.some(g=>g.slotId==='top'&&g.appearance!.lightness==='light'))warn('A pale top beside your lighter colouring can create a soft look. If you feel washed out, compare a medium-toned shirt or add a darker collar, scarf or tie.');
 if(profile.depth==='deep'&&known.some(g=>g.slotId==='top'&&g.appearance!.lightness==='dark'))warn('The dark top can create a tonal look beside your deeper colouring. For more definition, compare it with a lighter or brighter neckline.');
 if(profile.undertone!=='unknown')items.push(`You selected ${profile.undertone} undertones. Broad garment colour names cannot confirm warm or cool shades, so compare the actual fabric by your face; no colours are ruled out from this label.`);
 if(!items.length)items.push('There is not enough confirmed personal-colouring evidence to recommend a change. Compare two shirts or scarves in the same daylight and record which works better.');
 return {confidence:profile.confirmed?'User-confirmed profile; styling suggestions remain subjective':'Low — provisional or unconfirmed profile',items,warnings};
}
