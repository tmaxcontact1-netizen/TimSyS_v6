import type { RuleOutcome } from "./styling-engine.js";

// Reviewed families support broad coordination, not measured shade/texture precision.
// Bound correlated rewards by domain; retain every negative finding in full.
export function calibratedScore(outcomes: readonly RuleOutcome[], reviewed: boolean): number {
  if (!reviewed) return Math.max(0, Math.min(100, 70 + outcomes.reduce((n,o)=>n+o.scoreDelta,0)));
  const budgets: Record<string,number> = {colour:8,pattern:6,formality:6,ensemble:6,season:3};
  const positive = new Map<string,number>();
  let penalties=0;
  for(const o of outcomes) {
    if(o.scoreDelta<0) penalties+=o.scoreDelta;
    else positive.set(o.domain,(positive.get(o.domain)??0)+o.scoreDelta);
  }
  return Math.max(0,Math.min(100,60+penalties+[...positive].reduce((n,[domain,value])=>n+Math.min(value,budgets[domain]??0),0)));
}

export function hasUnresolvedCoordination(outcomes: readonly RuleOutcome[]): boolean {
  return outcomes.some(o=>o.measurements.provisional===true ||
    (o.ruleId==="appearance.uncertainty" && Array.isArray(o.measurements.uncertainFields) &&
      o.measurements.uncertainFields.some(f=>["primaryColour","secondaryColour","pattern","formality"].includes(String(f)))));
}

export function calibratedGrade(score:number, eligible:boolean, _outcomes:readonly RuleOutcome[], thresholds:{a:number;b:number;c:number}):"A"|"B"|"C"|null {
  if(!eligible)return null;
  if(score>=thresholds.a)return "A";
  return score>=thresholds.b?"B":score>=thresholds.c?"C":null;
}
