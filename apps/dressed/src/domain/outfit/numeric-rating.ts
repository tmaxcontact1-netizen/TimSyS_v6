import { coordinationProfile } from "./coordination.js";
import type { RuleOutcome, StylingContext, StylingGarment } from "./styling-engine.js";

export type RatingCheck={explanation:string;value:number;confidence:number;garmentIds:string[]};
export type RatingPart={id:string;label:string;points:number;maximum:number;checks:RatingCheck[]};
export type NumericRating={score:number;breakdown:RatingPart[];confidence:{score:number;label:string;explanation:string}};
const round=(n:number)=>Math.round(n*10)/10;
const mean=(values:number[],fallback:number)=>values.length?values.reduce((a,b)=>a+b,0)/values.length:fallback;
const family=(c:string)=>({navy:"blue",burgundy:"red"}[c]??c);
const neutral=new Set(["white","black","grey","navy","beige","brown"]);
type Profile=ReturnType<typeof coordinationProfile>;
const light=(p:Profile)=>p.a?.lightness==="dark"?0:p.a?.lightness==="medium"?1:p.a?.lightness==="light"?2:null;

// Heuristic coordination score, not a probability or colour measurement. Unknown
// facts lower evidence confidence; they never masquerade as confirmed clashes.
export function numericRating(garments:readonly StylingGarment[],context:StylingContext,outcomes:readonly RuleOutcome[],season?:string):NumericRating {
  const profiles=garments.map(coordinationProfile);
  const colour:RatingCheck[]=[],pattern:RatingCheck[]=[],occasion:RatingCheck[]=[],compatibility:RatingCheck[]=[];
  const add=(list:RatingCheck[],a:Profile,b:Profile|undefined,value:number,confidence:number,explanation:string)=>list.push({value:Math.max(0,Math.min(1,value)),confidence,explanation,garmentIds:[a.g.id,...(b?[b.g.id]:[])]});
  const pairs=[['top','bottom'],['bottom','footwear'],['top','jacket'],['top','neckwear'],['jacket','pocket_square'],['neckwear','pocket_square'],['belt','footwear']];
  for(const [left,right] of pairs){
    const a=profiles.find(p=>p.slot===left),b=profiles.find(p=>p.slot===right);
    if(!a||!b)continue;
    const ca=a.a?.primaryColour,cb=b.a?.primaryColour;
    if(!ca||!cb||ca==='unknown'||cb==='unknown') {add(colour,a,b,.72,0,`${a.g.name} + ${b.g.name}: colour relationship unassessed; a primary colour is unknown.`);continue;}
    const same=family(ca)===family(cb);
    const accentEcho=(a.a?.secondaryColour&&a.a.secondaryColour!=='unknown'&&family(a.a.secondaryColour)===family(cb))||(b.a?.secondaryColour&&b.a.secondaryColour!=='unknown'&&family(b.a.secondaryColour)===family(ca))||(a.a?.secondaryColour&&b.a?.secondaryColour&&a.a.secondaryColour!=='unknown'&&b.a.secondaryColour!=='unknown'&&family(a.a.secondaryColour)===family(b.a.secondaryColour));
    const bothNeutral=neutral.has(ca)&&neutral.has(cb);
    const related=[['pink','purple'],['pink','red'],['blue','green'],['blue','purple'],['red','orange']].some(p=>p.includes(family(ca))&&p.includes(family(cb)));
    let value=accentEcho?.94:same?.76:bothNeutral?.86:neutral.has(ca)||neutral.has(cb)?.88:related?.81:.72;
    let reason=accentEcho?'a pattern accent echoes the other garment':same?'the same broad colour family repeats':bothNeutral?'different neutral families provide a restrained combination':neutral.has(ca)||neutral.has(cb)?'a neutral supports the accent colour':related?'related accent families':'distinct accents require visual balance';
    const la=light(a),lb=light(b);
    let confidence=.6;
    if(la!==null&&lb!==null){const difference=Math.abs(la-lb);value+=difference===2?.06:difference===1?.03:same?-.08:0;confidence+=.2;reason+=difference?'; confirmed lightness gives separation':'; confirmed lightness is similar';}
    if(left==='belt') {value=same?.95:bothNeutral?.65:.55;reason=same?'belt and footwear share a colour family':'belt and footwear use different colour families';if([ca,cb].includes('black')&&[ca,cb].includes('brown')){value=.4;reason='black and brown belt/footwear mix; matching families are more cohesive';}}
    if(a.uncertain||b.uncertain)confidence*=.75;
    add(colour,a,b,value,confidence,`${a.g.name} + ${b.g.name}: ${reason}.`);
  }
  const upper=profiles.filter(p=>['top','jacket','neckwear','pocket_square'].includes(p.slot));
  for(let i=0;i<upper.length;i++)for(const b of upper.slice(i+1)){
    const a=upper[i]!,pa=a.a?.pattern,pb=b.a?.pattern;
    if(!pa||!pb||pa==='unknown'||pb==='unknown'){add(pattern,a,b,.72,0,`${a.g.name} + ${b.g.name}: pattern relationship unassessed.`);continue;}
    const active=pa!=='solid'&&pb!=='solid',same=a.motif===b.motif,scalesKnown=a.scale!=='unknown'&&b.scale!=='unknown';
    const value=!active?(pa===pb?.84:.92):scalesKnown?(a.scale!==b.scale?.9:same?.4:.65):same?.6:.76;
    add(pattern,a,b,value,active?(scalesKnown?.9:.45):.9,`${a.g.name} + ${b.g.name}: ${!active?(pa===pb?'quiet solid surfaces':'a solid gives the pattern room'):scalesKnown?(a.scale!==b.scale?'described pattern scales differ':'described scales compete'):`${same?'similar':'different'} motifs; scale needs checking`}.`);
  }
  for(const p of profiles){
    const f=p.formality;
    if(f===null){add(occasion,p,undefined,.72,0,`${p.g.name}: occasion suitability unassessed.`);continue;}
    const distance=Math.max(context.formalityMin-f,f-context.formalityMax,0);
    let value=distance?Math.max(.1,.8-distance*.22):.9;
    if(context.slug==='casual'&&['footwear','belt','neckwear','jacket'].includes(p.slot))value=f<=2?.96:f===3?.8:.55;
    if((context.formalityMin>=3)&&p.casual)value=Math.min(value,.45);
    if(season&&p.g.seasons.length&&!p.g.seasons.includes('all-season')&&!p.g.seasons.includes(season))value-=.2;
    add(occasion,p,undefined,value,p.inferred?.45:.95,`${p.g.name}: ${p.inferred?'inferred':'recorded'} formality ${f}, ${distance?'outside':'within'} ${context.name}'s range${season?`; season ${p.g.seasons.length?'checked':'unconfirmed'}`:''}.`);
  }
  for(const o of outcomes.filter(o=>o.ruleId==='garment.companion')){
    const p=profiles.find(p=>o.affectedGarmentIds.includes(p.g.id));if(p)add(compatibility,p,undefined,o.hardFailure?0:.92,o.hardFailure?1:.5,o.explanation);
  }
  const tie=profiles.find(p=>p.slot==='neckwear'),shoe=profiles.find(p=>p.slot==='footwear'),jacket=profiles.find(p=>p.slot==='jacket');
  if(shoe&&(tie||jacket)){const upperItem=tie??jacket!;add(compatibility,upperItem,shoe,shoe.casual?(tie?.55:.76):.92,.65,`${upperItem.g.name} + ${shoe.g.name}: ${shoe.casual?'casual footwear mixes levels of dress':'footwear supports the tailored elements'} (style inferred from garment type).`);}
  const definitions:[string,string,number,RatingCheck[]][]=[['colour','Colours',40,colour],['pattern','Patterns',20,pattern],['occasion','Occasion & season',20,occasion],['compatibility','Garment compatibility',20,compatibility]];
  const breakdown=definitions.map(([id,label,maximum,checks])=>({id,label,maximum,points:round(maximum*mean(checks.map(c=>c.value),id==='compatibility'?.85:.72)),checks}));
  const confidenceScore=Math.round(definitions.reduce((n,[id,,weight,checks])=>n+weight*mean(checks.map(c=>c.confidence),id==='compatibility'?.7:0),0));
  return {score:round(breakdown.reduce((n,p)=>n+p.points,0)),breakdown,confidence:{score:confidenceScore,label:confidenceScore>=80?'High':confidenceScore>=55?'Moderate':'Low',explanation:'Evidence coverage, not the probability an outfit looks good. Missing shades, pattern scale and inferred style reduce confidence separately from coordination.'}};
}
