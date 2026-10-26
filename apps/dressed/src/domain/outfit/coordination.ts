import { styleFor } from "../garment/visual-style.js";
import type { RuleOutcome, StylingContext, StylingGarment } from "./styling-engine.js";

const neutrals = new Set(["black", "white", "grey", "navy", "beige", "brown"]);
const family = (c: string) => ({navy:"blue", burgundy:"red"}[c] ?? c);
const related = (a: string, b: string) => family(a) === family(b) ||
  [["pink","purple"],["pink","red"],["blue","green"],["blue","purple"],["red","orange"]].some(p => p.includes(a) && p.includes(b));

// Descriptive notes are data only. Structured review fields always take precedence.
export function coordinationProfile(g: StylingGarment) {
  const a = g.fingerprint?.appearance;
  const owner = g.notes?.match(/Owner description:\s*([^\n]+)/i)?.[1] ?? "";
  const uncertain = /maybe|perhaps|believe|think|almost|ish\b|hard to|uncertain|little green/i.test(owner);
  const motifText = owner.toLowerCase();
  const motif = a?.pattern !== "patterned" ? a?.pattern : /paisley/.test(motifText) ? "paisley" : /dot|circle/.test(motifText) ? "dots" : /floral|flower|petal/.test(motifText) ? "floral" : a.pattern;
  const scale = /tight|small|fine/.test(motifText) ? "small" : /large|bold|wide/.test(motifText) ? "large" : "unknown";
  const colours = new Set<string>([a?.primaryColour, a?.secondaryColour].filter((c): c is NonNullable<typeof c> => !!c && c !== "unknown"));
  // Only supplement pattern accents from unambiguous owner descriptions, never from photo estimates.
  if (a && a.pattern !== "solid" && a.pattern !== "unknown" && !uncertain) {
    for (const c of motifText.match(/\b(black|white|grey|navy|blue|brown|beige|red|burgundy|green|yellow|orange|purple|pink)\b/g) ?? []) colours.add(c);
  }
  const text = `${g.categorySlug} ${g.name}`.toLowerCase();
  const slot = styleFor(g)?.slot ?? g.slotId ?? (/pocket.square/.test(text) ? "pocket_square" : /tie/.test(g.categorySlug) ? "neckwear" : /belt/.test(text) ? "belt" : /shoe|boot|trainer|sneaker|derby|oxford|footwear/.test(text) ? "footwear" : /shirt/.test(text) ? "top" : /jacket|blazer/.test(text) ? "jacket" : /chino|trouser/.test(text) ? "bottom" : "unknown");
  const casual = /trainer|sneaker|woven|casual belt/.test(text);
  const inferred = casual ? 1 : /oxford|derby|brogu|formal.belt|leather belt/.test(text) ? 3 : ["neckwear","pocket_square","jacket"].includes(slot) ? 3 : /shirt|chino/.test(text) ? 3 : null;
  return {g,a,owner,uncertain,motif,scale,colours:[...colours],slot,casual,formality:g.formality ?? inferred,inferred:g.formality === null && inferred !== null};
}

export function applyCoordination(garments: readonly StylingGarment[], context: StylingContext, outcomes: RuleOutcome[]) {
  const profiles = garments.map(coordinationProfile);
  if (!profiles.some(p => p.a)) return;
  const add = (ruleId:string, domain:string, scoreDelta:number, explanation:string, ids:string[], uncertain=false) => outcomes.push({ruleId,domain,scoreDelta,explanation,affectedGarmentIds:ids,passed:scoreDelta>=0&&!uncertain,hardFailure:false,explanationCode:ruleId,measurements:{provisional:uncertain,basis:"reviewed-fields-and-descriptive-style"}});
  const ids = garments.map(g=>g.id);
  const accents = [...new Set(profiles.flatMap(p=>p.colours).filter(c=>!neutrals.has(c)))];
  const primaryAccents = [...new Set(profiles.map(p=>p.a?.primaryColour).filter((c):c is NonNullable<typeof c>=>!!c&&c!=="unknown"&&!neutrals.has(c)))];
  const relatedPalette = primaryAccents.every((a,i)=>primaryAccents.slice(i+1).every(b=>related(a,b)));
  const completeColour=profiles.every(p=>p.a&&p.a.primaryColour!=="unknown");
  add("colour.relationships","colour",!completeColour?0:primaryAccents.length<=1?5:relatedPalette?3:primaryAccents.length>2?-7:0,
    !completeColour?"Some primary colours are unknown; overall palette coordination is unconfirmed.":`Primary accents: ${primaryAccents.join(", ")||"none"}. ${relatedPalette?"The colour families are related or form a single accent.":"Distinct accent families need visual balance; they are not automatically a clash."} Pattern accents considered: ${accents.join(", ")||"none"}.`,ids,!completeColour);
  const upper = profiles.filter(p=>["top","jacket","neckwear","pocket_square"].includes(p.slot));
  const echoedAccents=accents.filter(c=>upper.filter(p=>p.colours.some(d=>family(d)===family(c))).length>1);
  add("colour.accent_echo","colour",echoedAccents.length?3:0,echoedAccents.length?`Reviewed accent colours recur across upper garments: ${echoedAccents.join(", ")}.` : "No shared accent colour is established across the upper garments.",upper.map(p=>p.g.id));
  if(accents.length>3)add("colour.accent_load","colour",-4,`${accents.length} ground and pattern accent families are present; the palette may be busy.`,ids);
  for(let i=0;i<upper.length;i++) for(const b of upper.slice(i+1)) {
    const a=upper[i]!;
    if(!a.a||!b.a)continue;
    const bothPatterned=[a,b].every(p=>p.a!.pattern!=="solid"&&p.a!.pattern!=="unknown");
    if(bothPatterned) {
      const known=a.scale!=="unknown"&&b.scale!=="unknown";
      const same=a.motif===b.motif;
      add("pattern.relationship","pattern",known?(a.scale!==b.scale?3:same?-7:-3):same?-3:0,
        `${a.g.name} + ${b.g.name}: ${a.motif}/${b.motif}. ${known?(a.scale!==b.scale?"Different described scales provide separation.":"Similar described scales may compete."):"Pattern scale is unconfirmed; inspect these together."}`,[a.g.id,b.g.id],!known);
    }
  }
  const tie=profiles.find(p=>p.slot==="neckwear"), square=profiles.find(p=>p.slot==="pocket_square");
  if(tie?.a&&square?.a&&tie.a.primaryColour!=="unknown"&&square.a.primaryColour!=="unknown"){
    const echo=tie.colours.some(c=>square.colours.some(d=>family(c)===family(d)));
    const duplicate=tie.a.primaryColour===square.a.primaryColour&&tie.a.pattern===square.a.pattern&&tie.motif===square.motif;
    const white=square.a.primaryColour==="white"&&square.a.pattern==="solid";
    add("accessories.relationship","ensemble",duplicate?-5:echo?5:white?3:0,duplicate?"Tie and pocket square repeat the same colour family and pattern type; consider more variation (exact duplication is unverified).":echo?"Tie and pocket square echo a reviewed ground or accent colour without repeating the same pattern type.":white?"The solid white pocket square provides a quiet neutral alongside the tie.":"Tie and pocket square have no confirmed shared colour; check the accent balance together.",[tie.g.id,square.g.id],!echo&&!white);
  }
  const belt=profiles.find(p=>p.slot==="belt"), shoe=profiles.find(p=>p.slot==="footwear");
  if(belt?.a&&shoe?.a&&belt.a.primaryColour!=="unknown"&&shoe.a.primaryColour!=="unknown"){
    const match=family(belt.a.primaryColour)===family(shoe.a.primaryColour);
    const blackBrown=[belt.a.primaryColour,shoe.a.primaryColour].includes("black")&&[belt.a.primaryColour,shoe.a.primaryColour].includes("brown");
    add("accessories.belt_shoes","ensemble",match?4:blackBrown?-6:0,match?"Belt and footwear share a reviewed colour family; exact shades remain unmeasured.":blackBrown?"Black and brown belt/footwear are mixed; a matching family is preferred for a dressier outfit.":"Belt and footwear have different colour families; check their visual balance.",[belt.g.id,shoe.g.id]);
  }
  const work=context.formalityMin>=3||/work|business|office|formal/.test(context.slug);
  const casualContext=!work&&(context.slug==="casual"||context.formalityMax<=2);
  const known=profiles.filter(p=>p.formality!==null);
  const mismatches=known.filter(p=>work?p.casual||p.formality!<context.formalityMin:casualContext?p.formality!>context.formalityMax:false);
  const mixed=!!tie&&profiles.some(p=>p.slot==="footwear"&&p.casual);
  if(casualContext&&shoe?.casual)add("context.casual_footwear","formality",3,"Casual footwear suits the selected casual occasion.",[shoe.g.id]);
  add("context.reviewed_style","formality",mismatches.length?-Math.min(18,mismatches.length*6):mixed?-6:known.length===profiles.length?4:0,
    mismatches.length?`${context.name}: ${mismatches.map(p=>p.g.name).join(", ")} lean ${work?"more casual":"dressier"} than the occasion.`:mixed?"A tie with trainers mixes dressy and casual elements; treat this as an intentional style choice.":`No identified style conflict for ${context.name}.`,ids);
  const inferred=profiles.filter(p=>p.inferred);
  if(inferred.length)add("coordination.style_uncertainty","formality",0,`Style inferred from garment type for ${inferred.map(p=>p.g.name).join(", ")}; confirm formality in Edit. Work dress codes vary.`,inferred.map(p=>p.g.id),true);
  for(const p of profiles.filter(p=>p.uncertain))add("coordination.description_uncertainty","colour",0,`${p.g.name}: your description contains uncertainty (${p.owner}). Additional colours from that text were not treated as confirmed.`,[p.g.id],true);
}
