import {expect,test} from 'vitest';
import {evaluateStyling,type StylingGarment} from '../../src/domain/outfit/styling-engine.js';
import {reviewedFingerprint,type Appearance} from '../../src/domain/garment/appearance-review.js';
const context={id:'context',slug:'smart-casual',name:'Smart casual',formalityMin:2,formalityMax:4};
const garment=(id:string,slotId:string,colour:Appearance['primaryColour'],lightness:Appearance['lightness']='unknown'):StylingGarment=>({id,name:id,slotId,categorySlug:slotId,status:'available',formality:null,seasons:[],fingerprintId:id,fingerprint:reviewedFingerprint({primaryColour:colour,secondaryColour:null,pattern:'solid',texture:'unknown',lightness,saturation:'unknown'},null,null)});
const base=[garment('White shirt','top','white','light'),garment('Navy chinos','bottom','navy','dark')];
test('points add to the numeric total and confidence is a separate bounded value',()=>{
 const e=evaluateStyling({garments:[...base,garment('Brown Derby shoes','footwear','brown')],context});
 expect(e.breakdown?.reduce((n,p)=>n+p.maximum,0)).toBe(100);
 expect(e.breakdown?.reduce((n,p)=>n+p.points,0)).toBeCloseTo(e.score,1);
 expect(e.confidence!.score).toBeGreaterThanOrEqual(0);expect(e.confidence!.score).toBeLessThanOrEqual(100);
});
test('confirming an inferred formality raises confidence without changing coordination',()=>{
 const first=evaluateStyling({garments:base,context});
 const confirmed=evaluateStyling({garments:base.map(g=>({...g,formality:3})),context});
 expect(confirmed.score).toBe(first.score);expect(confirmed.confidence!.score).toBeGreaterThan(first.confidence!.score);
});
test('known lightness differences produce a gradient within one colour family',()=>{
 const dark=evaluateStyling({garments:[garment('Blue shirt','top','blue','dark'),garment('Blue jacket','jacket','blue','dark')],context});
 const light=evaluateStyling({garments:[garment('Blue shirt','top','blue','light'),garment('Blue jacket','jacket','blue','dark')],context});
 expect(light.score).toBeGreaterThan(dark.score);
 expect(light.breakdown!.find(p=>p.id==='colour')!.points).toBeGreaterThan(dark.breakdown!.find(p=>p.id==='colour')!.points);
});
test('renaming identifiers cannot create artificial score differences',()=>{
 const first=evaluateStyling({garments:base,context});
 const second=evaluateStyling({garments:base.map(g=>({...g,id:g.id+'-other'})),context});
 expect(second.score).toBe(first.score);expect(second.confidence).toEqual(first.confidence);
});
