// Partial release: preserve every published runtime file except the explicit
// Observation Studio overlay. Never install, restart, or touch a live database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile,copyFile,symlink,rmdir} from 'node:fs/promises';
import {resolve,join,relative,sep,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {cumulativeBundles,publishedBaseline} from './update-manifest-merge.mjs';
const root=resolve(import.meta.dirname,'..'),[tag,folder]=process.argv.slice(2);
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
const out=resolve(root,folder||'');assert.ok(out.startsWith(join(root,'dist-updates')+sep));
const baseline=JSON.parse(await readFile(join(out,'timsys-update.json'),'utf8'));
assert.deepEqual(await publishedBaseline(),baseline,'Published baseline changed; stop and rebase the release.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=baseline.bundles.find(b=>b.id==='platform'),archive=join(out,new URL(base.url).pathname.split('/').at(-1));
const bytes=await readFile(archive);assert.equal(bytes.length,base.size);assert.equal(sha(bytes),base.sha256);
const stage=join(out,'platform');await mkdir(stage);
execFileSync('tar.exe',['-xf',archive,'-C',stage],{windowsHide:true});
async function inventory(dir){const entries=await readdir(dir,{recursive:true,withFileTypes:true});assert.ok(entries.every(e=>!e.isSymbolicLink()),'Unexpected archive link');const files=entries.filter(e=>e.isFile()).map(e=>join(e.parentPath,e.name));const result={};let i=0;await Promise.all(Array.from({length:16},async()=>{while(i<files.length){const p=files[i++];result[relative(dir,p).split(sep).join('/')]=sha(await readFile(p));}}));return result;}
const before=await inventory(stage);
const changed=['modules/builder/index.js'];
for(const file of changed){const baseSource=execFileSync('git',['show',`origin/main:platform/${file}`],{cwd:root,encoding:'utf8'});assert.equal((await readFile(join(stage,file),'utf8')).replaceAll('\r\n','\n'),baseSource.replaceAll('\r\n','\n'),'Published file differs from reviewed base: '+file);await copyFile(join(root,'platform',file),join(stage,file));}
const moduleRoot=join(root,'platform/modules/observation_studio'),added=[];
for(const e of await readdir(moduleRoot,{recursive:true,withFileTypes:true})){if(!e.isFile()||e.name.endsWith('.test.cjs'))continue;const source=join(e.parentPath,e.name),file='modules/observation_studio/'+relative(moduleRoot,source).split(sep).join('/');assert.ok(!before[file],'Unexpected existing module file '+file);await mkdir(dirname(join(stage,file)),{recursive:true});await copyFile(source,join(stage,file));added.push(file);}
const after=await inventory(stage);assert.deepEqual(Object.keys(after).sort(),[...Object.keys(before),...added].sort());assert.deepEqual(Object.keys(before).filter(p=>before[p]!==after[p]).sort(),changed);
const installed=JSON.parse(await readFile(join(process.env.APPDATA,'timsys-launcher/updates/state.json'),'utf8'));
const installedPlatform=installed.bundles.platform.path,require=createRequire(import.meta.url);
const {UpdateManager}=require(join(installedPlatform,'native/desktop/update-manager.cjs'));
// validateBundle only reads installed state and candidate files.
const manager=new UpdateManager({dataRoot:join(process.env.APPDATA,'timsys-launcher'),currentLauncherVersion:'1.1.0',baselineFile:join(installedPlatform,'installed-baseline.json')});
await manager.validateBundle('platform',stage);await manager.validateBundle('launcher-ui',join(root,'apps/launcher/dist'));
const ui=join(root,'apps/launcher/dist');assert.equal(sha(await readFile(join(ui,'observation-studio/index.html'))),sha(await readFile(join(root,'apps/principaled/public/observation-studio/index.html'))));
await symlink(join(stage,'modules-runtime'),join(stage,'node_modules'),'junction');
try{const log=execFileSync(process.execPath,['--test',join(root,'platform/modules/observation_studio/http.test.cjs')],{cwd:root,env:{...process.env,OBSERVATION_VERIFY_PLATFORM:stage},windowsHide:true,encoding:'utf8',timeout:120000,maxBuffer:20*1024*1024});await writeFile(join(out,'staged-http.log'),log);}catch(e){await writeFile(join(out,'staged-http.log'),String(e.stdout||'')+'\n'+String(e.stderr||''));throw e;}finally{await rmdir(join(stage,'node_modules'));}
assert.deepEqual(await inventory(stage),after,'Staged acceptance mutated package files');
const replacements=[];
for(const[id,dir]of [['platform',stage],['launcher-ui',ui]]){const filename=`${id}-${tag}.zip`,zip=join(out,filename);execFileSync('tar.exe',['-a','-cf',zip,'-C',dir,'.'],{windowsHide:true});const data=await readFile(zip),digest=sha(data);const extracted=join(out,'verified-'+id);await mkdir(extracted);execFileSync('tar.exe',['-xf',zip,'-C',extracted],{windowsHide:true});assert.deepEqual(await inventory(extracted),await inventory(dir));await manager.validateBundle(id,extracted);replacements.push({id,version:digest.slice(0,24),sha256:digest,size:data.length,url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/${filename}`});}
assert.deepEqual(await publishedBaseline(),baseline,'Another release was published while packaging.');
const manifest={...baseline,releaseVersion:tag,publishedAt:new Date().toISOString(),notes:'Principal’Ed Observation Studio: full TBO and probation workflows, scheduling, PD, permissions, reporting and JSON exchange. Unbranded clean-start templates. Existing installations automatically receive the Observations module. Research’Ed, Dress’Ed, Trade’Ed and native runtime/AI/database contracts preserved. No school data or test records included.',bundles:cumulativeBundles(baseline,replacements)};
await writeFile(join(out,'baseline-manifest.json'),JSON.stringify(baseline,null,2)+'\n');await writeFile(join(out,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
const verification={release:tag,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baselineRelease:baseline.releaseVersion,changedPlatformFiles:changed,addedPlatformFiles:added,retainedPlatformFiles:Object.keys(before).length-changed.length,installedGuardsPassed:true,stagedHttpPassed:true,archiveRoundTripPassed:true,tradeedBundleUnchanged:true,liveStateModified:false,retainedBundles:manifest.bundles.filter(b=>!replacements.some(r=>r.id===b.id)),bundles:replacements};
await writeFile(join(out,'observation-release-verification.json'),JSON.stringify(verification,null,2)+'\n');console.log(JSON.stringify(verification,null,2));
