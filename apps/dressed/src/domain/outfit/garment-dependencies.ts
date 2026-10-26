import { styleFor } from "../garment/visual-style.js";
import type { StylingGarment, RuleOutcome } from "./styling-engine.js";
import { coordinationProfile } from "./coordination.js";

export const companionSlots: Readonly<Record<string, string>> = {
  pocket_square: "jacket", neckwear: "top", waistcoat: "top", belt: "bottom", tie_clip:"neckwear", cufflinks:"top", lapel_pin:"jacket", suspenders:"bottom",
};
export const companionReasons: Readonly<Record<string, string>> = {
  pocket_square: "A pocket square needs a blazer or suit jacket with a breast pocket; ordinary outerwear does not qualify.",
  neckwear: "Neckwear needs a suitable top; a tie or bow tie needs a collared shirt.",
  waistcoat: "A waistcoat needs a top underneath.",
  tie_clip:"A tie clip needs a straight tie; bow ties and cravats do not take a tie clip.",
  cufflinks:"Cufflinks need a shirt with French or compatible double cuffs.",
  lapel_pin:"A lapel pin needs a jacket lapel.",
  suspenders:"Suspenders need trousers with suitable fastening points.",
  belt: "A belt needs compatible trousers or bottoms; check that they have belt loops.",
};
export function withCompanions(slots: readonly string[]): string[] {
  const result = new Set(slots);
  for (const slot of result) if (companionSlots[slot]) result.add(companionSlots[slot]!);
  return [...result];
}
export function dependencyOutcomes(garments: readonly StylingGarment[]): RuleOutcome[] {
  const profiles = garments.map(coordinationProfile);
  const outcomes: RuleOutcome[] = [];
  for (const p of profiles) {
    const required = companionSlots[p.slot];
    if (!required) continue;
    const companion = profiles.find(c => c.slot === required);
    const incompatibleTie = p.slot === "neckwear" && /ties|bow.tie/i.test(p.g.categorySlug) && companion && /t-shirt|tshirt|sweatshirt|hoodie|crew.neck/i.test(`${companion.g.categorySlug} ${companion.g.name}`);
    const incompatibleAccessory = p.slot==='tie_clip' && companion && styleFor(companion.g)?.id!=='tie'
      || p.slot==='cufflinks' && companion && (companion.g.visualStyle?.cuffs==='button'||['tshirt','polo','sweater'].includes(styleFor(companion.g)?.id??''));
    const failure = !companion || !!incompatibleTie || !!incompatibleAccessory;
    outcomes.push({ruleId:"garment.companion",domain:"ensemble",passed:false,hardFailure:failure,scoreDelta:0,
      explanationCode:failure?"required_companion_missing_or_incompatible":"companion_detail_unconfirmed",
      explanation: failure ? `${p.g.name}: ${companionReasons[p.slot]}` : `${p.g.name}: required ${required} included. ${companionReasons[p.slot]} Construction details are not recorded; check suitability.`,
      affectedGarmentIds:[p.g.id,...(companion?[companion.g.id]:[])],measurements:{requiredSlot:required,provisional:!failure}});
  }
  return outcomes;
}
