import type { StylingEvaluation } from './styling-engine.js';

// Presentation only: retain the engine's scores and evidence, but explain the
// actual comparisons without exposing rule names or inventing measured shades.
export function explainComparison(text: string): string {
  const phrases: [string, string][] = [
    ['a pattern accent echoes the other garment', 'a colour in the pattern picks up a colour in the other piece, tying them together'],
    ['the same broad colour family repeats', 'the similar colours give a tonal look'],
    ['different neutral families provide a restrained combination', 'these understated colours are easy to wear together'],
    ['a neutral supports the accent colour', 'the quieter colour lets the more colourful piece stand out'],
    ['related accent families', 'the colours sit close together for a softer combination'],
    ['distinct accents require visual balance', 'both colours draw attention; try making one piece quieter if the combination feels busy'],
    ['confirmed lightness gives separation', 'the light–dark difference keeps the pieces distinct'],
    ['confirmed lightness is similar', 'the pieces are similarly light or dark'],
    ['black and brown belt/footwear mix; matching families are more cohesive', 'try a black belt with black shoes, or a brown belt with brown shoes, for a more pulled-together finish'],
    ['belt and footwear share a colour family', 'the belt and shoes repeat the same colour, giving the outfit a consistent finish'],
    ['belt and footwear use different colour families', 'try a belt closer to the shoe colour for a more consistent finish'],
    ['quiet solid surfaces', 'the plain fabrics keep the combination simple and easy on the eye'],
    ['a solid gives the pattern room', 'the plain piece lets the pattern stand out without competing with it'],
    ['described pattern scales differ', 'the different-sized patterns help each piece stand out'],
    ['described scales compete', 'the patterns are similar in size and may compete; try replacing one with a plain piece or a noticeably larger or smaller pattern'],
    ['similar motifs; scale needs checking', 'the patterns look alike in type; compare their size side by side, or swap one for a plain piece'],
    ['different motifs; scale needs checking', 'the patterns differ in type; check that one is noticeably larger or quieter so they do not compete'],
    ['colour relationship unassessed; a primary colour is unknown', 'confirm the missing colour before relying on this pairing'],
    ['pattern relationship unassessed', 'confirm the pattern before judging how these pieces work together'],
    ['occasion suitability unassessed', 'check how dressy this piece is before wearing it for this occasion'],
    ['casual footwear mixes levels of dress', 'the shoes make the tailored pieces feel more relaxed; choose dressier shoes if you want a consistent smart look'],
    ['footwear supports the tailored elements', 'the shoes suit the dressier pieces and help finish the outfit'],
    [' (style inferred from garment type)', ' (based on garment type; check the finish in person)'],
  ];
  for (const [from, to] of phrases) text = text.replaceAll(from, to);
  return text.replace(/required \w+ included\. /g, '')
    .replace('Construction details are not recorded; check suitability.', 'The garment details do not confirm this yet.')
    .replace(/Formality varies by \d+ levels across the ensemble\./, 'Some pieces are noticeably dressier than others. For a more consistent look, bring the most casual or most formal piece closer to the rest.')
    .replace('Formality is coherent across the ensemble.', 'The pieces have a similar level of dress, so none feels out of place.')
    .replace(/(inferred|recorded) formality \d+, (within|outside) (.+?)'s range/, (_match, basis: string, position: string, context: string) =>
    `${basis === 'inferred' ? 'based on its type, this piece appears' : 'your saved details describe this piece as'} ${position === 'within' ? `suited to ${context}` : `a different level of dress from ${context}; consider a more suitable alternative`}`)
    .replace('; season unconfirmed', '; check its fabric weight for the weather')
    .replace('; season checked', '; the saved season preference was also considered');
}

export function evaluationAdvice(evaluation: StylingEvaluation, garments: readonly {id: string; name: string}[]) {
  const names = (ids: readonly string[]) => ids.map(id => garments.find(g => g.id === id)?.name).filter(Boolean).join(' and ');
  const checks = (evaluation.breakdown ?? []).flatMap(part => part.checks.map(check => ({...check, area: part.id})));
  const works: string[] = [], improve: string[] = [], uncertain: string[] = [];
  // Prefer the strongest garment-to-garment relationships, with room for both
  // colour and pattern observations rather than twelve variations of one claim.
  for (const area of ['colour', 'pattern', 'compatibility']) {
    const best = checks.filter(c => c.area === area && c.confidence > 0 && c.value >= .8 && !c.explanation.includes('Construction details are not recorded')).sort((a,b) => b.value-a.value).slice(0, 2);
    works.push(...best.map(c => explainComparison(c.explanation)));
  }
  const occasion = checks.filter(c => c.area === 'occasion');
  if (occasion.length && occasion.every(c => c.value >= .8 && c.confidence > 0))
    works.push('The pieces are at a similar level of dress for the occasion you chose.');
  const weak = checks.filter(c => c.value < .8 && c.confidence > 0).sort((a,b) => a.value-b.value).slice(0, 3);
  improve.push(...weak.map(c => {
    const text = explainComparison(c.explanation);
    return c.area === 'colour' && c.explanation.includes('same broad colour family')
      ? `${text} For more definition, try a lighter or darker version of one piece.` : text;
  }));
  const outcomes = evaluation.outcomes ?? [...evaluation.cautions, ...evaluation.majorPenalties];
  for (const item of outcomes) {
    if (item.ruleId === 'accessories.relationship') {
      if (item.scoreDelta < 0) improve.push(`${names(item.affectedGarmentIds)} repeat both colour and pattern. Try a plain pocket square, or one that picks up a small colour in the tie instead of matching its main colour.`);
      else if (item.scoreDelta > 0) works.push(item.explanation.includes('solid white')
        ? 'The plain white pocket square gives the tie room to be the focal point.'
        : 'The tie and pocket square pick up a shared colour, which helps connect the two accessories. They do not need to match exactly.');
      else uncertain.push('Lay the tie and pocket square against the jacket. Their recorded colours do not establish a clear link; try a plain white square if they compete.');
    }
    if (item.ruleId === 'colour.accent_load') improve.push('Several colours are competing for attention. Try replacing one colourful accessory with a plain, quieter piece.');
    if (item.ruleId === 'coordination.description_uncertainty') uncertain.push(`You were unsure about some colours in ${names(item.affectedGarmentIds)}. Check that piece beside the outfit in daylight before relying on its colour match.`);
    if (item.ruleId === 'garment.companion' && !item.hardFailure && !item.passed) uncertain.push(explainComparison(item.explanation));
  }
  const appearance = outcomes.filter(o => o.ruleId === 'appearance.uncertainty');
  const fields = [...new Set(appearance.flatMap(o => (o.measurements.uncertainFields as string[] | undefined) ?? []))];
  const labels: Record<string,string> = {primaryColour:'main colour', secondaryColour:'pattern colours', lightness:'how light or dark it is', saturation:'colour intensity', pattern:'pattern', texture:'fabric texture', formality:'how dressy it is', season:'season suitability'};
  if (appearance.length) uncertain.push(`This advice uses your saved colour descriptions. Compare the pieces together in daylight: exact shades and fabric finishes can still change how the outfit looks.${fields.length ? ` Still worth checking: ${fields.map(f=>labels[f] ?? f).join(', ')}.` : ''}`);
  if (checks.some(c => c.confidence === 0)) uncertain.push('Some details are missing, so part of the score is a starting estimate. Confirm the missing colours, patterns or occasion details in the garment editor.');
  // Preserve specific safety/season/style issues not covered by the pair advice.
  const covered = new Set(['appearance.uncertainty','coordination.style_uncertainty','coordination.description_uncertainty','colour.relationships','colour.reviewed_families','colour.accent_load','pattern.relationship','pattern.reviewed_types','accessories.relationship','accessories.belt_shoes','garment.companion']);
  for (const item of [...evaluation.cautions, ...evaluation.majorPenalties]) {
    if (!covered.has(item.ruleId) && item.explanationCode !== 'appearance_not_precisely_measured') improve.push(explainComparison(item.explanation));
  }
  if (!improve.length && !evaluation.hardFailures.length && works.length) improve.push('There is no obvious change needed from the details recorded. Try it on as a whole and check the fit, trouser length and shoe condition; those can matter more than another colour change.');
  return [
    {name:'Change before wearing',kind:'blocking',items:evaluation.hardFailures.map(o=>o.explanation)},
    {name:'Why this works',kind:'positive',items:works},
    {name:'What you could improve',kind:'caution',items:improve},
    {name:'What to check in person',kind:'caution',items:uncertain},
  ].map(group=>({...group,items:[...new Set(group.items)]})).filter(group=>group.items.length);
}
