import {expect,test} from 'vitest';
import {garmentStyles,slotFor} from '../../src/domain/garment/visual-style.js';
import {garmentInputSchema} from '../../src/domain/garment/garment.js';
import {dependencyOutcomes,withCompanions} from '../../src/domain/outfit/garment-dependencies.js';
import type {StylingGarment} from '../../src/domain/outfit/styling-engine.js';
// @ts-expect-error Frontend JavaScript renderer tested with the shared style model.
import {mannequinMesh} from '../../frontend/src/mannequin-renderer.js';
const g=(slug:string,kind='auto',cuffs:'unknown'|'button'|'french'='unknown'):StylingGarment=>({id:slug,name:slug,categorySlug:slug,visualStyle:{kind,cuffs},status:'available',formality:3,seasons:[],fingerprintId:null,fingerprint:null});
test('style fields validate and round-trip without silently accepting unknown styles',()=>{
 const input={name:'Test coat',categoryId:'00000000-0000-4000-8000-000000000001',visualStyle:{kind:'trench',closure:'closed',side:'left'}};
 expect(garmentInputSchema.parse(input).visualStyle).toEqual(input.visualStyle);
 expect(garmentInputSchema.safeParse({...input,visualStyle:{kind:'invented'}}).success).toBe(false);
});
test('accessory categories get independent slots and dependent selections expand',()=>{
 expect(['watches','glasses','hats','tie-bars','cufflinks'].map(categorySlug=>slotFor({categorySlug}))).toEqual(['watch','eyewear','headwear','tie_clip','cufflinks']);
 expect(withCompanions(['tie_clip','cufflinks','lapel_pin'])).toEqual(expect.arrayContaining(['neckwear','top','jacket']));
});
test('clips require straight ties and cufflinks reject button cuffs',()=>{
 expect(dependencyOutcomes([g('tie-bars'),g('bow-ties'),g('shirts')]).some(x=>x.hardFailure)).toBe(true);
 expect(dependencyOutcomes([g('tie-bars'),g('ties'),g('shirts')]).some(x=>x.hardFailure)).toBe(false);
 expect(dependencyOutcomes([g('cufflinks'),g('shirts','shirt','button')]).some(x=>x.hardFailure)).toBe(true);
 expect(dependencyOutcomes([g('cufflinks'),g('shirts','shirt','french')]).some(x=>x.hardFailure)).toBe(false);
});
const appearance={primaryColour:'blue',secondaryColour:'white',pattern:'solid'};
test('every listed style produces finite geometry; coat lengths and fastenings differ',()=>{
 for(const style of garmentStyles){
   const mesh=mannequinMesh([{categorySlug:'shirts',appearance},{slotId:'bottom',appearance},{categorySlug:'ties',appearance},{categorySlug:'blazers',appearance},{categorySlug:style.categories[0],visualStyle:{kind:style.id},appearance}]);
   expect(mesh.length,style.id).toBeGreaterThan(0);
   expect(mesh.every((f:{points:number[][]})=>f.points.flat().every(Number.isFinite)),style.id).toBe(true);
 }
 const coat=(kind:string,closure='open')=>mannequinMesh([{categorySlug:'coats',visualStyle:{kind,closure},appearance}]);
 expect(coat('trench')).not.toEqual(coat('bomber'));
 expect(coat('trench','closed')).not.toEqual(coat('trench','open'));
});
