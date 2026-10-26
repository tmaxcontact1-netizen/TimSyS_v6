import {expect,test} from 'vitest';
import {evaluationAdvice} from '../../src/domain/outfit/evaluation-advice.js';
import {evaluateStyling,type StylingGarment} from '../../src/domain/outfit/styling-engine.js';
import {reviewedFingerprint,type Appearance} from '../../src/domain/garment/appearance-review.js';
const context={id:'context',slug:'smart-casual',name:'Smart casual',formalityMin:2,formalityMax:4};
const garment=(name:string,slotId:string,colour:Appearance['primaryColour'],pattern:Appearance['pattern']='solid'):StylingGarment=>({id:name,name,slotId,categorySlug:slotId,status:'available',formality:3,seasons:['all-season'],fingerprintId:name,fingerprint:reviewedFingerprint({primaryColour:colour,secondaryColour:null,pattern,texture:'unknown',lightness:'unknown',saturation:'unknown'},null,null)});
const base=[garment('White shirt','top','white'),garment('Navy chinos','bottom','navy')];
test('explains actual pieces and offers practical advice without changing the score',()=>{
 const e=evaluateStyling({garments:base,context}),before=JSON.stringify(e);
 const groups=evaluationAdvice(e,base),text=JSON.stringify(groups);
 expect(text).toContain('White shirt + Navy chinos');
 expect(text).toContain('easy to wear together');
 expect(text).not.toMatch(/colour families|Primary accents|pattern accents/);
 expect(groups.some(g=>g.name==='What you could improve')).toBe(true);
 expect(text).toContain('exact shades');
 expect(JSON.stringify(e)).toBe(before);
});
test('black belt and brown shoes produce a specific change',()=>{
 const garments=[...base,garment('Black belt','belt','black'),garment('Brown shoes','footwear','brown')];
 const text=JSON.stringify(evaluationAdvice(evaluateStyling({garments,context}),garments));
 expect(text).toContain('black belt with black shoes, or a brown belt with brown shoes');
 expect(text).not.toContain('There is no obvious change needed');
});
test('repeating tie and square suggests variation and preserves unknown scale',()=>{
 const garments=[...base,garment('Navy jacket','jacket','navy'),garment('Blue tie','neckwear','blue','striped'),garment('Blue square','pocket_square','blue','striped')];
 const text=JSON.stringify(evaluationAdvice(evaluateStyling({garments,context}),garments));
 expect(text).toContain('Try a plain pocket square');
 expect(text).toContain('compare their size side by side');
});
test('companion failure remains visible and unknown colour is not praised',()=>{
 const garments=[...base,garment('Unknown square','pocket_square','unknown')];
 const e=evaluateStyling({garments,context}),groups=evaluationAdvice(e,garments);
 expect(groups.find(g=>g.kind==='blocking')?.items.length).toBeGreaterThan(0);
 expect(groups.find(g=>g.name==='What to check in person')?.items.join(' ')).toContain('main colour');
});
