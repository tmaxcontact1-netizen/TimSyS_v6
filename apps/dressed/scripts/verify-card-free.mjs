// Real PostgreSQL + built HTTP application acceptance. Never uses the user's cluster.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url),app=resolve(process.env.DRESSED_VERIFY_APP_ROOT??resolve(import.meta.dirname,'..'));
const {createDressedServer}=await import(pathToFileURL(join(app,'dist/src/entrypoints/api.js')).href);
const {migrate}=await import(pathToFileURL(join(app,'dist/scripts/migrate.js')).href);
const {LocalPostgresManager}=require('../../launcher/electron/local-postgres-manager.cjs');
const workingRoot=process.env.DRESSED_VERIFY_ROOT??tmpdir();await mkdir(workingRoot,{recursive:true});
const work=await mkdtemp(join(workingRoot,'dressed-card-free-'));
const manager=new LocalPostgresManager({binaryRoot:process.env.DRESSED_VERIFY_POSTGRES_BIN??resolve(app,'../launcher/.cache/postgres'),dataRoot:work});
const checks=[];let server,pool,base;
const check=(name)=>{checks.push(name);console.log(`PASS ${name}`);};
async function request(path,method='GET',body){const response=await fetch(base+path,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json()};}
async function startServer(){server=createDressedServer({database:pool,publicDirectory:join(app,'dist/frontend'),storageRoot:join(work,'storage')});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
async function stopServer(){if(server){server.closeAllConnections();await new Promise(r=>server.close(r));server=null;}}
async function fixture(flat=false){const w=1000,h=1000,pixels=Buffer.alloc(w*h*3,235);if(!flat)for(let y=100;y<900;y++)for(let x=300;x<700;x++){const p=(y*w+x)*3;pixels[p]=25;pixels[p+1]=40;pixels[p+2]=80;}return sharp(pixels,{raw:{width:w,height:h,channels:3}}).png().toBuffer();}
const photo=await fixture(),flat=await fixture(true);
await writeFile(join(work,'garment.png'),photo);await writeFile(join(work,'low-contrast.png'),flat);
try{
 const state=await manager.start();
 const migrations=await migrate({connectionString:state.migrationUrl,migrationDirectory:join(app,'migrations')});assert(migrations.includes('0010_card_free_intake.sql'));
 assert.deepEqual(await migrate({connectionString:state.migrationUrl,migrationDirectory:join(app,'migrations')}),[]);
 await manager.grantSchemaPrivileges('dressed');pool=new pg.Pool({connectionString:state.runtimeUrl});await startServer();
 assert.equal((await request('/api/health')).status,200);check('Fresh migrations, replay and built API health');
 const categories=(await request('/api/categories')).data.items,uses=(await request('/api/garment-uses')).data.items;
 const create=async(slug,name)=>(await request('/api/garments','POST',{categoryId:categories.find(x=>x.slug===slug).id,name,brand:'Preserve brand',materials:[{material:'Wool',percentage:100}]})).data;
 const upload=async(id,bytes=photo)=>{const response=await fetch(`${base}/api/garments/${id}/images?role=whole&filename=phone.png`,{method:'POST',body:bytes});assert.equal(response.status,201);return(await response.json()).image;};
 const analyse=async(id,image,crop=null)=>{const result=await request(`/api/garments/${id}/intake/analyse`,'POST',{imageId:image.id,crop});assert.equal(result.status,201);return result.data;};
 const appearance={primaryColour:'navy',secondaryColour:null,lightness:'dark',saturation:'muted',pattern:'unknown',texture:'unknown'};
 const reviewPayload=async(g,a=null)=>( {version:(await request(`/api/garments/${g.id}`)).data.version,analysisId:a?.id??null,name:g.name,categoryId:g.categoryId,formality:4,seasons:['all-season'],useIds:[uses[0].id],appearance} );
 const garments=[];let firstImage,firstAnalysis,firstPayload;
 for(const [slug,name] of [['formal-shirts','Review shirt'],['formal-trousers','Review trousers'],['oxford-shoes','Review shoes']]){
  const g=await create(slug,name),image=await upload(g.id),analysis=await analyse(g.id,image),payload=await reviewPayload(g,analysis);
  assert.equal(image.calibrationProfileId,null);assert.equal(analysis.result.appearance.primaryColour,'navy');
  assert(!(await request('/api/ensembles/catalogue')).data.garments.some(x=>x.id===g.id));
  const saved=await request(`/api/garments/${g.id}/intake/review`,'POST',payload);assert.equal(saved.status,201);
  const after=(await request(`/api/garments/${g.id}`)).data;assert.equal(after.brand,'Preserve brand');assert.equal(after.materials[0].material,'Wool');
  garments.push(g);if(!firstImage){firstImage=image;firstAnalysis=analysis;firstPayload=payload;}
 }
 check('One card-free photograph per garment: detection, editable review, preserved metadata, eligibility only after confirmation');
 const original=Buffer.from(await(await fetch(`${base}/api/images/${firstImage.id}/content`)).arrayBuffer());assert.deepEqual(original,photo);check('Original bytes preserved');
 const g=garments[0];
 const crop=await analyse(g.id,firstImage,{x:.32,y:.15,width:.34,height:.65});assert.equal(crop.result.selection,'manual');assert.deepEqual(Buffer.from(await(await fetch(`${base}/api/images/${firstImage.id}/content`)).arrayBuffer()),photo);
 const unchanged=(await request(`/api/garments/${g.id}/intake`)).data.review;assert.equal(unchanged.values.appearance.pattern,'unknown');assert.equal(unchanged.is_current,true);check('In-app crop and reanalysis preserve originals and confirmed values');
 assert.equal((await request(`/api/garments/${g.id}/intake/analyse`,'POST',{imageId:firstImage.id,crop:{x:.9,y:0,width:.5,height:1}})).status,400);
 assert.equal((await request(`/api/garments/${g.id}/intake/review`,'POST',firstPayload)).status,409);check('Crop bounds and concurrent edits rejected');
 const bad=await create('casual-shirts','Manual fallback');const badImage=await upload(bad.id,flat);const failed=await analyse(bad.id,badImage);assert.equal(failed.result.fingerprint,null);assert.equal(failed.result.appearance.primaryColour,'unknown');
 assert.equal((await request(`/api/garments/${bad.id}/intake/review`,'POST',await reviewPayload(bad,failed))).status,201);check('Undetectable photograph offers manual review that can be saved');
 const context=(await request('/api/styling/catalogue')).data.contexts.find(x=>x.slug==='formal-business');
 const generate=()=>request('/api/ensembles/generate','POST',{selectedGarmentId:g.id,contextId:context.id,useId:uses[0].id});
 const generation=await generate();assert.equal(generation.status,200);const outfit=[...generation.data.a,...generation.data.b,...generation.data.c][0];assert(outfit);assert(outfit.evaluation.outcomes.some(x=>x.ruleId==='appearance.uncertainty'));assert.equal(outfit.evaluation.outcomes.find(x=>x.ruleId==='colour.contrast').scoreDelta,0);
 const savedOutfit=await request('/api/ensembles/save','POST',{name:'Reviewed outfit',garmentIds:outfit.garments.map(x=>x.id),contextId:context.id,useId:uses[0].id});assert.equal(savedOutfit.status,201);check('Reviewed appearance flows into generated and saved outfits with uncertainty and no precise colour penalty');
 await upload(g.id);assert.equal((await request(`/api/garments/${g.id}/fingerprint`)).status,404);
 const stale={...await reviewPayload(g,firstAnalysis)};assert.equal((await request(`/api/garments/${g.id}/intake/review`,'POST',stale)).status,409);
 const stateAfter=(await request(`/api/garments/${g.id}/intake`)).data;assert.equal(stateAfter.review.values.appearance.primaryColour,'navy');assert.equal(stateAfter.review.is_current,false);check('Replacement invalidates fingerprint, retains review history and blocks stale analysis');
 assert.equal((await request(`/api/garments/${g.id}/intake/review`,'POST',await reviewPayload(g))).status,201);
 const invalid=await fetch(`${base}/api/garments/${g.id}/images?role=whole`,{method:'POST',body:'not an image'});assert.equal(invalid.status,415);check('Invalid upload rejected without blocking manual correction');
 await stopServer();await startServer();assert.equal((await request(`/api/garments/${g.id}/intake`)).data.review.values.appearance.primaryColour,'navy');assert.deepEqual(Buffer.from(await(await fetch(`${base}/api/images/${firstImage.id}/content`)).arrayBuffer()),photo);check('Application restart preserves confirmed values and historical original images');
 const artifacts=['dist/src/entrypoints/api.js','dist/src/infrastructure/images/card-free-analysis.js','dist/src/infrastructure/database/intake-repository.js','dist/src/domain/outfit/appearance-uncertainty.js'];
 const hashes=Object.fromEntries(await Promise.all(artifacts.map(async file=>[file,createHash('sha256').update(await readFile(join(app,file))).digest('hex')])));
 await writeFile(join(work,'verification.json'),JSON.stringify({passed:true,observedAt:new Date().toISOString(),controlledSyntheticFixture:true,checks,hashes},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,work,base,fixture:join(work,'garment.png')}));
 if(process.argv.includes('--serve')){console.log('UI verification server ready; create stop file in work directory to finish.');while(true){try{await access(join(work,'stop'));break;}catch{await new Promise(r=>setTimeout(r,500));}}}
}finally{await stopServer();if(pool)await pool.end();await manager.stop();}
