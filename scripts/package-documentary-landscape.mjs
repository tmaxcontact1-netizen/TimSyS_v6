// Preserve the verified published platform; overlay only the two Phase 1 backend files.
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
const hash=b=>createHash('sha256').update(b).digest('hex');
const output=join(root,'dist-updates',`documentary-landscape-${tag}`),stage=join(output,'platform');
await mkdir(output);await mkdir(stage); // Never reuse a prior stage.
const baseline=await publishedBaseline(),base=baseline.bundles.find(b=>b.id==='platform');
assert.ok(base);
const response=await fetch(base.url);assert.ok(response.ok);
const archive=Buffer.from(await response.arrayBuffer());
assert.equal(archive.length,base.size);assert.equal(hash(archive),base.sha256);
await writeFile(join(output,'baseline-platform.zip'),archive);
execFileSync('tar.exe',['-xf',join(output,'baseline-platform.zip'),'-C',stage],{windowsHide:true});
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
const before=await inventory(stage);
const changed=['modules/nervous_breakdown/index.js','modules/nervous_breakdown/module.json'];
for(const file of changed) {
  const old=execFileSync('git',['show',`${baseCommit}:platform/${file}`],{cwd:root,encoding:'utf8'});
  assert.equal((await readFile(join(stage,file),'utf8')).replaceAll('\r\n','\n'),old.replaceAll('\r\n','\n'),`Published ${file} differs from reviewed base`);
  await copyFile(join(root,'platform',file),join(stage,file));
}
const after=await inventory(stage);
assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
assert.deepEqual(Object.keys(before).filter(file=>before[file]!==after[file]).sort(),changed.slice().sort());
await writeFile(join(output,'platform-inventory.json'),JSON.stringify({before,after},null,2));
const require=createRequire(import.meta.url),asar=require('../apps/launcher/node_modules/@electron/asar');
const guard=asar.extractFile(join(process.env.LOCALAPPDATA,'Programs/TimSyS Launcher/resources/app.asar'),'electron/update-manager.cjs');
const guardPath=join(output,'installed-update-manager.cjs');await writeFile(guardPath,guard);
const {UpdateManager}=require(guardPath);
const manager=new UpdateManager({dataRoot:join(process.env.APPDATA,'timsys-launcher'),currentLauncherVersion:'1.0.20',manifestUrl:'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/latest/download/timsys-update.json'});
await manager.validateBundle('platform',stage);
await manager.validateBundle('launcher-ui',join(root,'apps/launcher/dist'));
await symlink(join(stage,'modules-runtime'),join(stage,'node_modules'),'junction');
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
} finally {await rmdir(join(stage,'node_modules'));}
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
  notes:'Principal’Ed Nervous Breakdown Phase 1: read-only documentary landscape, role/dimension navigation, exact source context and search. Existing AI integration and Research’Ed preserved. No data import, reset or relationship functionality.',
  bundles:cumulativeBundles(baseline,replacements)};
await writeFile(join(output,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,'phase1-verification.json'),JSON.stringify({
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  baseRelease:baseline.releaseVersion,basePlatform:base,backendFilesChanged:changed,
  unaffectedPlatformFiles:Object.keys(before).length-changed.length,
  installedGuardSha256:hash(guard),installedGuardPassed:true,stagedRealCorpusBrowserPassed:true,
  stagedAiUiBrowserPassed:true,installedDatabaseTouched:false,sourceRecordsChanged:false,
  retainedBundles:manifest.bundles.filter(b=>!replacements.some(r=>r.id===b.id)),bundles:replacements
},null,2)+'\n');
console.log(JSON.stringify({output,bundles:replacements,baseline:baseline.releaseVersion},null,2));
