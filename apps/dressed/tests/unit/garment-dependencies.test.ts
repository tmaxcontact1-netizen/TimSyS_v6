import {expect,test} from 'vitest';
import {withCompanions,dependencyOutcomes} from '../../src/domain/outfit/garment-dependencies.js';
import {evaluateStyling} from '../../src/domain/outfit/styling-engine.js';
import {generateEnsembles} from '../../src/domain/outfit/ensemble-engine.js';
import {reviewedFingerprint} from '../../src/domain/garment/appearance-review.js';
const context={id:'test',slug:'smart-casual',name:'Smart casual',formalityMin:2,formalityMax:4};
const g=(id:string,slotId:string,categorySlug=slotId)=>({id,name:id,slotId,categorySlug,status:'available',formality:null,seasons:[],imageId:null,fingerprintId:id,fingerprint:reviewedFingerprint({primaryColour:'white',secondaryColour:null,pattern:'solid',texture:'unknown',lightness:'unknown',saturation:'unknown'},null,null)});
test('companion categories expand once and ordinary outerwear cannot replace a jacket',()=>{
 expect(withCompanions(['pocket_square','neckwear','belt','waistcoat'])).toEqual(['pocket_square','neckwear','belt','waistcoat','jacket','top','bottom']);
 expect(dependencyOutcomes([g('square','pocket_square'),g('coat','outerwear')]).some(o=>o.hardFailure)).toBe(true);
});
test('evaluation blocks an orphan square and incompatible tie; accepts companions with construction caution',()=>{
 expect(evaluateStyling({garments:[g('square','pocket_square'),g('shirt','top')],context}).eligible).toBe(false);
 expect(evaluateStyling({garments:[g('tie','neckwear','ties'),g('T-shirt','top','t-shirts')],context}).eligible).toBe(false);
 const valid=evaluateStyling({garments:[g('square','pocket_square'),g('jacket','jacket')],context});
 expect(valid.eligible).toBe(true);expect(valid.cautions.some(o=>o.ruleId==='garment.companion')).toBe(true);
});
test('generation adds required jacket and never returns an orphan even with allowIncomplete',()=>{
 const square=g('square','pocket_square'),shirt=g('shirt','top'),jacket=g('jacket','jacket');
 const input={selected:square,available:[square,shirt,jacket],requirements:[{slotId:'top',requirement:'required' as const,minimumItems:1,maximumItems:1}],context,parameters:{},thresholds:{a:85,b:72,c:60}};
 const valid=generateEnsembles(input);const outfits=[...valid.a,...valid.b,...valid.c];expect(outfits.length).toBeGreaterThan(0);expect(outfits.every(o=>o.garments.some(g=>g.slotId==='jacket'))).toBe(true);
 const invalid=generateEnsembles({...input,available:[square,shirt],allowIncomplete:true});expect([...invalid.a,...invalid.b,...invalid.c]).toHaveLength(0);
});
