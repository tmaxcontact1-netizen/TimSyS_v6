import {expect,test} from 'vitest';
// @ts-expect-error The dependency-free renderer is a frontend JavaScript module.
import {mannequinMesh,previewMaterial} from '../../frontend/src/mannequin-renderer.js';
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
