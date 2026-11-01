import {expect,test,vi} from 'vitest';
import {duplicateGarment} from '../../src/infrastructure/database/duplicate-garment.js';

function fixture(options:{stale?:boolean;fail?:boolean}={}) {
 const query=vi.fn(async(sql:string,params?:unknown[])=>{
   if(sql.startsWith('SELECT name'))return {rows:options.stale?[]:[{name:'White shirt'}],rowCount:options.stale?0:1};
   if(sql.startsWith('SELECT 1'))return {rows:[],rowCount:params?.[0]==='White shirt (copy 2)'?1:0};
   if(sql.startsWith('SELECT * FROM dressed.garment_images'))return {rows:[{image_id:'photo',media_type:'image/jpeg',original_relative_path:'source/photo/original.jpg'}]};
   if(sql.startsWith('SELECT * FROM dressed.visual_fingerprints'))return {rows:[{fingerprint_id:'fingerprint',whole_image_id:'photo',detail_image_id:null,schema_version:'1',algorithm_version:'reviewed',measurement_payload:{appearance:{primaryColour:'white',analysisId:'source-analysis'}},confidence:0}]};
   if(sql.startsWith('SELECT values'))return {rows:[{values:{name:'White shirt',version:9,analysisId:'source-analysis',appearance:{primaryColour:'white'},details:{name:'White shirt',size:'M'}}}]};
   if(options.fail&&sql.startsWith('INSERT INTO dressed.visual_fingerprints'))throw Error('write failed');
   return {rows:[],rowCount:1};
 });
 const release=vi.fn(),pool={connect:async()=>({query,release})};
 const images={read:vi.fn(async()=>Buffer.from('photo')),writeOriginal:vi.fn(async({garmentId,imageId}:{garmentId:string;imageId:string})=>`${garmentId}/${imageId}/original.jpg`),removeGarment:vi.fn(async()=>{})};
 return {query,release,pool,images};
}
test('copy has independent IDs, images and reviewed details, without history',async()=>{
 const f=fixture(),copy=await duplicateGarment(f.pool as never,f.images as never,'source',9,'2026-10-25');
 expect(copy?.name).toBe('White shirt (copy 3)');expect(copy?.id).not.toBe('source');
 const photo=f.images.writeOriginal.mock.calls[0]![0];expect(photo.garmentId).toBe(copy?.id);expect(photo.imageId).not.toBe('photo');
 const fingerprint=f.query.mock.calls.find(([sql])=>sql.startsWith('INSERT INTO dressed.visual_fingerprints'))![1]!;
 expect(fingerprint[4]).toBe(photo.imageId);expect(JSON.parse(String(fingerprint[6])).appearance).toEqual({primaryColour:'white',analysisId:null});
 const review=f.query.mock.calls.find(([sql])=>sql.startsWith('INSERT INTO dressed.garment_appearance_reviews'))![1]!;
 expect(JSON.parse(String(review[3]))).toMatchObject({name:copy?.name,version:1,analysisId:null,details:{name:copy?.name,size:'M'}});
 expect(f.query.mock.calls.map(([sql])=>sql).join('\n')).not.toMatch(/INSERT INTO dressed\.(wear_|garment_care|saved_outfit|planned_outfit)/);
 expect(f.query).toHaveBeenCalledWith('COMMIT');expect(f.images.removeGarment).not.toHaveBeenCalled();
});
test('stale version creates nothing',async()=>{
 const f=fixture({stale:true});expect(await duplicateGarment(f.pool as never,f.images as never,'source',9,'2026-10-25')).toBeNull();
 expect(f.images.writeOriginal).not.toHaveBeenCalled();expect(f.query).toHaveBeenCalledWith('ROLLBACK');
});
test('failed copy rolls back data and removes only the new photo directory',async()=>{
 const f=fixture({fail:true});await expect(duplicateGarment(f.pool as never,f.images as never,'source',9,'2026-10-25')).rejects.toThrow('write failed');
 expect(f.query).toHaveBeenCalledWith('ROLLBACK');expect(f.query).not.toHaveBeenCalledWith('COMMIT');
 expect(f.images.removeGarment).toHaveBeenCalledWith(f.images.writeOriginal.mock.calls[0]![0].garmentId);expect(f.images.removeGarment).not.toHaveBeenCalledWith('source');expect(f.release).toHaveBeenCalled();
});
