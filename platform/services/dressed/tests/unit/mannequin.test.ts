import {expect,test} from 'vitest';
// @ts-expect-error The dependency-free renderer is a frontend JavaScript module.
import {mannequinMesh,previewMaterial,garmentPreviewMaterial,patternColourAt} from '../../../../../apps/dressed/frontend/src/mannequin-renderer.js';
test('missing appearance uses a neutral placeholder and cannot invent a pattern colour',()=>{
 expect(previewMaterial(null)).toEqual(previewMaterial({primaryColour:'unknown'}));
 expect(previewMaterial({primaryColour:'navy',pattern:'striped'}).secondary).toBeNull();
});
test('complete ensemble produces finite, independently coloured 3D surfaces',()=>{
 const items=['top','bottom','footwear','belt','neckwear','pocket_square','jacket'].map((slotId,i)=>({slotId,appearance:{primaryColour:i%2?'navy':'white',secondaryColour:'red',pattern:'striped'}}));
 const before=JSON.stringify(items),mesh=mannequinMesh(items);
 expect(mesh.length).toBeGreaterThan(1000);
 expect(mesh.every((face:{points:number[][];colour:number[]})=>face.points.flat().every(Number.isFinite)&&face.colour.every(Number.isFinite))).toBe(true);
 expect(JSON.stringify(items)).toBe(before);
});
test('a pocket square without a jacket cannot float over the mannequin',()=>{
 expect(mannequinMesh([{slotId:'pocket_square',appearance:{primaryColour:'red'}}])).toEqual(mannequinMesh([]));
});

test('skin colour changes exposed skin while unknown garments remain grey',()=>{
 const grey=mannequinMesh([{slotId:'top'}]);
 const coloured=mannequinMesh([{slotId:'top'}],'#c69275');
 expect(coloured.map((f:any)=>f.points)).toEqual(grey.map((f:any)=>f.points));
 expect(coloured.some((f:any)=>f.colour.join(',')==='198,146,117')).toBe(true);
 expect(coloured.some((f:any)=>f.colour.join(',')==='140,148,150')).toBe(true);
 expect(mannequinMesh([],null)).toEqual(mannequinMesh([]));
 expect(mannequinMesh([],'invalid')).toEqual(mannequinMesh([]));
});


test('curved surfaces retain unit outward normals and finite texture coordinates',()=>{
 const mesh=mannequinMesh([{slotId:'jacket',appearance:{primaryColour:'navy'}},{slotId:'top',appearance:{primaryColour:'white'}}]);
 const curved=mesh.filter((f:any)=>f.normals);
 expect(curved.length).toBeGreaterThan(1000);
 for(const face of curved){
  for(const n of face.normals)expect(Math.hypot(...n)).toBeCloseTo(1,5);
  expect(face.uv.flat().every(Number.isFinite)).toBe(true);
 }
 const head=curved.filter((f:any)=>f.points.every((p:number[])=>p[1]>3.72&&p[1]<3.84));
 expect(head.length).toBeGreaterThan(0);
 expect(head.every((f:any)=>f.normals.every((n:number[],i:number)=>n[0]*f.points[i][0]+n[2]*f.points[i][2]>-.03))).toBe(true);
});


test('pattern rendering uses confirmed colours and distinguishes described motifs',()=>{
 const material=(name:string,pattern='patterned',secondaryColour:string|null='red')=>garmentPreviewMaterial({slotId:'neckwear',name,appearance:{primaryColour:'navy',secondaryColour,pattern}});
 const sample=(m:any)=>Array.from({length:144},(_,i)=>patternColourAt(m,(i%12)*.007,Math.floor(i/12)*.007).join(',')).join(';');
 const dots=material('Red dots'),flowers=material('Red floral'),paisley=material('Red paisley');
 expect(dots.variant).toBe('dots');expect(flowers.variant).toBe('floral');expect(paisley.variant).toBe('paisley');
 expect(new Set([sample(dots),sample(flowers),sample(paisley)]).size).toBe(3);
 const unknown=material('Paisley','patterned',null);
 expect(patternColourAt(unknown,.01,.02)).toEqual(unknown.colour);
 const solid=material('Previously described as paisley','solid');
 expect(patternColourAt(solid,.01,.02)).toEqual(solid.colour);
});

test('stripes have garment-appropriate direction and small panels retain fabric coordinates',()=>{
 const shirt=garmentPreviewMaterial({slotId:'top',appearance:{primaryColour:'blue',secondaryColour:'white',pattern:'striped'}});
 const tie=garmentPreviewMaterial({slotId:'neckwear',appearance:{primaryColour:'blue',secondaryColour:'white',pattern:'striped'}});
 expect(shirt.diagonal).toBe(false);expect(tie.diagonal).toBe(true);
 expect(patternColourAt(shirt,.01,.01)).toEqual(patternColourAt(shirt,.01,.03));
 const mesh=mannequinMesh([{slotId:'neckwear',name:'Paisley tie',appearance:{primaryColour:'navy',secondaryColour:'red',pattern:'patterned'}},{slotId:'top'},{slotId:'jacket'},{slotId:'pocket_square',name:'Dotted square',appearance:{primaryColour:'white',secondaryColour:'blue',pattern:'patterned'}}]);
 expect(mesh.some((f:any)=>f.material?.variant==='paisley'&&f.uv?.length===3)).toBe(true);
 expect(mesh.some((f:any)=>f.material?.variant==='dots'&&f.uv?.length===3)).toBe(true);
});

test('female changes silhouette while preserving materials, patterns and valid normals',()=>{
 const items=[{slotId:'top',appearance:{primaryColour:'white'}},{slotId:'jacket',appearance:{primaryColour:'navy',secondaryColour:'white',pattern:'checked'}}];
 const original=JSON.stringify(items),male=mannequinMesh(items),female=mannequinMesh(items,null,'female');
 expect(mannequinMesh(items,null,'male')).toEqual(male);
 expect(female.length).toBe(male.length);
 expect(female.map((f:any)=>f.colour)).toEqual(male.map((f:any)=>f.colour));
 expect(female.map((f:any)=>f.material)).toEqual(male.map((f:any)=>f.material));
 expect(female.map((f:any)=>f.uv)).toEqual(male.map((f:any)=>f.uv));
 expect(female.map((f:any)=>f.points)).not.toEqual(male.map((f:any)=>f.points));
 for(const face of female){
  expect(face.points.flat().every(Number.isFinite)).toBe(true);
  for(const normal of face.normals||[])expect(Math.hypot(...normal)).toBeCloseTo(1,5);
 }
 expect(JSON.stringify(items)).toBe(original);
 const span=(mesh:any[],low:number,high:number)=>Math.max(...mesh.flatMap(f=>f.points.filter((p:number[])=>p[1]>low&&p[1]<high).map((p:number[])=>Math.abs(p[0]))));
 expect(span(female,3.05,3.15)).toBeLessThan(span(male,3.05,3.15));
 expect(span(female,2.05,2.15)).toBeGreaterThan(span(male,2.05,2.15));
});
