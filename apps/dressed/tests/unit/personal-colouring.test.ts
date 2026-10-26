import {expect,test} from 'vitest';
import {analyseSamples,samplePixels,personalColouringAdvice,emptyColouringProfile,personalColouringSchema} from '../../src/domain/personal-colouring/profile.js';
const sample=(lightness:number)=>({lightness,spread:2,clipped:0});
const id='00000000-0000-4000-8000-000000000001';
test('photo analysis refuses depth from uneven or clipped skin samples',()=>{expect(analyseSamples({skinLeft:sample(70),skinRight:sample(40)}).depth).toBe('unknown');expect(analyseSamples({skinLeft:{...sample(60),clipped:.2},skinRight:sample(60)}).depth).toBe('unknown');expect(analyseSamples({skinLeft:sample(60)}).contrast).toBe('unknown');});
test('even skin and hair/eye samples produce only provisional depth/contrast, never undertone',()=>{const a=analyseSamples({skinLeft:sample(74),skinRight:sample(75),hair:sample(25),eyes:sample(30)});expect(a).toMatchObject({depth:'light',contrast:'high',warnings:[]});expect(a).not.toHaveProperty('undertone');});
test('pixel sample measures brightness and catches exposure clipping',()=>{expect(samplePixels([255,255,255,255]).clipped).toBe(1);expect(samplePixels([128,128,128,255]).lightness).toBeGreaterThan(50);expect(()=>samplePixels([])).toThrow();});
test('disabled profile yields no advice and empty profile validates',()=>{expect(personalColouringSchema.parse(emptyColouringProfile)).toEqual(emptyColouringProfile);expect(personalColouringAdvice(emptyColouringProfile,[]).items).toEqual([]);});
test('near-face feedback overrides a generic pale-top warning and ignores shoes',()=>{const p={...emptyColouringProfile,enabled:true,depth:'light',feedback:[{garmentId:id,result:'works',notes:'Compared in daylight'}]};const result=personalColouringAdvice(p,[{id,name:'White shirt',slotId:'top',appearance:{lightness:'light'}}]);expect(result.items.join(' ')).toContain('works for you');expect(result.items.join(' ')).not.toContain('pale top');expect(personalColouringAdvice({...p,feedback:[{garmentId:id,result:'washes-out',notes:''}]},[{id,name:'Shoes',slotId:'footwear'}]).items.join(' ')).not.toContain('Shoes');});
test('missing lightness stays uncertain; colour names do not stand in for shade data',()=>{const result=personalColouringAdvice({...emptyColouringProfile,enabled:true,contrast:'high'},[{id,name:'Blue shirt',slotId:'top',appearance:{primaryColour:'blue',lightness:'unknown'}}]);expect(result.items.join(' ')).toContain('Lightness is unconfirmed');expect(result.items.join(' ')).not.toContain('similar in lightness');});
test('schema rejects invalid profile choices, photos and excessive sample storage',()=>{expect(personalColouringSchema.safeParse({...emptyColouringProfile,undertone:'certainly-warm'}).success).toBe(false);expect(personalColouringSchema.safeParse({...emptyColouringProfile,portrait:'private image'}).success).toBe(false);expect(personalColouringSchema.safeParse({...emptyColouringProfile,samples:Array(6).fill({depth:'light',contrast:'high',warnings:[]})}).success).toBe(false);});

test('mannequin colour is optional, resettable and cannot affect styling advice',()=>{
 const profile={...emptyColouringProfile,mannequinColour:'#c69275'};
 expect(personalColouringSchema.parse(profile).mannequinColour).toBe('#c69275');
 expect(personalColouringSchema.parse({...profile,mannequinColour:null}).mannequinColour).toBeNull();
 expect(personalColouringSchema.safeParse({...profile,mannequinColour:'invalid'}).success).toBe(false);
 expect(personalColouringAdvice(profile,[])).toEqual(personalColouringAdvice(emptyColouringProfile,[]));
});

test('washout and contrast risks are prominent warnings, with garment feedback taking priority',()=>{
 const garment={id,name:'White shirt',slotId:'top',appearance:{lightness:'light'}};
 const profile={...emptyColouringProfile,enabled:true,depth:'light'};
 expect(personalColouringAdvice(profile,[garment]).warnings.join(' ')).toContain('washed out');
 expect(personalColouringAdvice({...profile,feedback:[{garmentId:id,result:'works',notes:''}]},[garment]).warnings).toEqual([]);
 expect(personalColouringAdvice({...profile,feedback:[{garmentId:id,result:'washes-out',notes:''}]},[garment]).warnings.join(' ')).toContain('you recorded');
 expect(personalColouringAdvice(profile,[{...garment,slotId:'footwear'}]).warnings).toEqual([]);
 expect(personalColouringAdvice(profile,[{...garment,appearance:{lightness:'unknown'}}]).warnings).toEqual([]);
 expect(personalColouringAdvice({...profile,contrast:'low'},[garment,{...garment,id:'jacket',slotId:'jacket',appearance:{lightness:'dark'}}]).warnings.join(' ')).toContain('overpowering');
});
