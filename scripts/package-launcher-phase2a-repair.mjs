// Preserve the verified published platform; overlay only the Phase 2A backend files.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile,readdir,symlink,rmdir} from 'node:fs/promises';
import {join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {publishedBaseline,cumulativeBundles} from './update-manifest-merge.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),[tag,baseCommit]=process.argv.slice(2);
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
assert.match(baseCommit||'',/^[a-f0-9]{7,40}$/);
assert.ok(process.env.NB_ACCEPTANCE_PROJECT,'Read-only source snapshot required for staged acceptance');
assert.equal(process.env.NB_PHASE2A_ACCEPTANCE,'1','Phase 2A browser acceptance required');
assert.ok(!process.env.NB_FROZEN_JD_MATRIX,'Use the packaged central engine for acceptance');
const hash=b=>createHash('sha256').update(b).digest('hex');
const output=join(root,'dist-updates',`documentary-landscape-${tag}`),stage=join(output,'platform');
const reuse=process.env.NB_REUSE_STAGE==='1';
if(!reuse){await mkdir(output);await mkdir(stage);}
const baseline=await publishedBaseline(),base=baseline.bundles.find(b=>b.id==='platform');
assert.ok(base);
const archive=process.env.NB_BASELINE_ARCHIVE?await readFile(process.env.NB_BASELINE_ARCHIVE):await (async()=>{const response=await fetch(base.url);assert.ok(response.ok);return Buffer.from(await response.arrayBuffer());})();
assert.equal(archive.length,base.size);assert.equal(hash(archive),base.sha256);
await writeFile(join(output,'baseline-platform.zip'),archive);
if(!reuse)execFileSync('tar.exe',['-xf',join(output,'baseline-platform.zip'),'-C',stage],{windowsHide:true});
async function inventory(directory) {
  const entries=await readdir(directory,{recursive:true,withFileTypes:true});
  assert.ok(entries.every(entry=>!entry.isSymbolicLink()),'Unexpected staged symlink');
  const paths=entries.filter(entry=>entry.isFile()).map(entry=>join(entry.parentPath,entry.name)).sort();
  const files={};let next=0;
  await Promise.all(Array.from({length:16},async()=>{
    while(next<paths.length){
      const file=paths[next++];
      files[relative(directory,file).split(sep).join('/')]=hash(await readFile(file));
    }
  }));
  return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
}
const saved=reuse?JSON.parse(await readFile(join(output,'platform-inventory.json'),'utf8')):null;
if(reuse)assert.deepEqual(await inventory(stage),saved.after,'Cannot reuse a modified test stage');
const before=reuse?saved.before:await inventory(stage);
const changed=['modules/nervous_breakdown/documentary-connections.js'];
for(const file of changed) {
  const old=execFileSync('git',['show',`${baseCommit}:platform/${file}`],{cwd:root,encoding:'utf8'});
  if(!reuse)assert.equal((await readFile(join(stage,file),'utf8')).replaceAll('\r\n','\n'),old.replaceAll('\r\n','\n'),`Published ${file} differs from reviewed base`);
  await copyFile(join(root,'platform',file),join(stage,file));
}
const added=[];
for(const file of added){assert.ok(!before[file],`Unexpected existing ${file}`);await copyFile(join(root,'platform',file),join(stage,file));}
const after=await inventory(stage);
assert.deepEqual(Object.keys(after).sort(),[...Object.keys(before),...added].sort());
assert.deepEqual(Object.keys(before).filter(file=>before[file]!==after[file]).sort(),changed.slice().sort());
await writeFile(join(output,'platform-inventory.json'),JSON.stringify({before,after},null,2));
const require=createRequire(import.meta.url),asar=require('../apps/launcher/node_modules/@electron/asar');
const installedState=JSON.parse(await readFile(join(process.env.APPDATA,'timsys-launcher/updates/state.json'),'utf8'));
const guard=await readFile(join(installedState.bundles.platform.path,'native/desktop/update-manager.cjs'));
const guardPath=join(output,'installed-update-manager.cjs');await writeFile(guardPath,guard);
const {UpdateManager}=require(join(installedState.bundles.platform.path,'native/desktop/update-manager.cjs'));
const manager=new UpdateManager({dataRoot:join(process.env.APPDATA,'timsys-launcher'),currentLauncherVersion:'1.1.0',manifestUrl:'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/latest/download/timsys-update.json'});
await manager.validateBundle('platform',stage);
await manager.validateBundle('launcher-ui',join(root,'apps/launcher/dist'));
const hadNodeModules=Boolean(after['node_modules/.package-lock.json'])||Object.keys(after).some(f=>f.startsWith('node_modules/'));
if(!hadNodeModules)await symlink(join(stage,'modules-runtime'),join(stage,'node_modules'),'junction');
try {
  for(const script of ['landscape-e2e.cjs','principaled-ai-ui-e2e.cjs']) {
    try {
      const log=execFileSync(process.execPath,[join(root,'scripts',script)],{cwd:root,windowsHide:true,timeout:180000,
        env:{...process.env,PRINCIPALED_VERIFY_PLATFORM:stage},encoding:'utf8',maxBuffer:10*1024*1024});
      await writeFile(join(output,script+'.log'),log);
    } catch(e) {
      await writeFile(join(output,script+'.log'),String(e.stdout||'')+'\n'+String(e.stderr||''));
      throw e;
    }
  }
} finally {if(!hadNodeModules)await rmdir(join(stage,'node_modules'));}
assert.deepEqual(await inventory(stage),after,'Staged tests modified packaged platform files');
const replacements=[];
for(const [id,source] of [['platform',stage],['launcher-ui',join(root,'apps/launcher/dist')]]) {
  const filename=`${id}-${tag}.zip`,destination=join(output,filename);
  execFileSync('tar.exe',['-a','-cf',destination,'-C',source,'.'],{windowsHide:true});
  const bytes=await readFile(destination),sha256=hash(bytes);
  replacements.push({id,version:sha256.slice(0,24),url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/${filename}`,size:bytes.length,sha256});
}
assert.deepEqual(await publishedBaseline(),baseline,'Published release changed; rebuild against the new baseline');
const manifest={...baseline,releaseVersion:tag,publishedAt:new Date().toISOString(),
  notes:'Restore PrincipalEd Phase 2A documentary navigation in the TimSyS 1.1 UI and use the central documentary engine. ResearchEd bundle and engine preserved; no data changes. Install only after active research finishes.',
  bundles:cumulativeBundles(baseline,replacements)};
await writeFile(join(output,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,'phase2a-verification.json'),JSON.stringify({
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  baseRelease:baseline.releaseVersion,basePlatform:base,backendFilesChanged:changed,backendFilesAdded:added,
  unaffectedPlatformFiles:Object.keys(before).length-changed.length,
  installedGuardSha256:hash(guard),installedGuardPassed:true,stagedRealCorpusBrowserPassed:true,
  stagedAiUiBrowserPassed:true,installedDatabaseTouched:false,sourceRecordsChanged:false,
  retainedBundles:manifest.bundles.filter(b=>!replacements.some(r=>r.id===b.id)),bundles:replacements
},null,2)+'\n');
console.log(JSON.stringify({output,bundles:replacements,baseline:baseline.releaseVersion},null,2));
