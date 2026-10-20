import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile,symlink,rmdir,unlink,access,readdir} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publishedBaseline,cumulativeBundles} from './update-manifest-merge.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),tag=process.argv[2],baseCommit=process.argv[3];
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);assert.match(baseCommit||'',/^[a-f0-9]{7,40}$/);
const out=join(root,'dist-updates',`nb-retirement-${tag}`),stage=join(out,'platform');
await mkdir(out,{recursive:true});await mkdir(stage);
const hash=b=>createHash('sha256').update(b).digest('hex');
const baseline=await publishedBaseline();
const state=JSON.parse(await readFile(join(process.env.APPDATA,'timsys-launcher/updates/state.json'),'utf8'));
const base=state.bundles.platform;
assert.ok(resolve(base.path).startsWith(resolve(process.env.APPDATA,'timsys-launcher/updates/bundles/platform')+sep));
const inventory={};
async function snapshot(source,destination,prefix='') {
  for(const entry of await readdir(source,{withFileTypes:true})) {
    // The launcher recreates this dependency junction; modules-runtime is the durable copy.
    if(entry.name==='node_modules'&&prefix==='')continue;
    assert.ok(!entry.isSymbolicLink(),`Unexpected symlink: ${prefix}${entry.name}`);
    const rel=prefix+entry.name,src=join(source,entry.name),dest=join(destination,entry.name);
    if(entry.isDirectory()){await mkdir(dest);await snapshot(src,dest,rel+'/');}
    else {const data=await readFile(src);inventory[rel]=hash(data);await writeFile(dest,data);assert.equal(hash(await readFile(dest)),inventory[rel]);}
  }
}
await snapshot(base.path,stage);
await writeFile(join(out,'baseline-files.json'),JSON.stringify(inventory,null,2)+'\n');
const changes=execFileSync('git',['diff','--name-status',baseCommit,'--','platform'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const changed=[];
for(const line of changes) {
  const [status,file]=line.trim().split(/\s+/);if(file.startsWith('platform/tests/'))continue;
  const rel=file.slice('platform/'.length),target=resolve(stage,rel);
  assert.ok(target.startsWith(resolve(stage)+sep));
  if(status!=='A') {
    const old=execFileSync('git',['show',`${baseCommit}:${file}`],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
    let published;try{published=(await readFile(target,'utf8')).replaceAll('\r\n','\n');}catch(e){if(status==='D'&&file.endsWith('.md'))continue;throw e;}
    if(rel==='index.js') {
      // The published platform contains unrelated changes; preserve every one.
      const obsolete="pathname === '/nervous-breakdown/import' ? 16 * 1024 * 1024 : ";
      assert.equal(published.split(obsolete).length,2);
      await writeFile(target,published.replace(obsolete,''));changed.push({status:'scoped replacement',file});continue;
    }
    assert.equal(published,old,`Published ${file} differs from audited base`);
  }
  if(status==='D')await unlink(target);
  else {await mkdir(dirname(target),{recursive:true});await copyFile(join(root,file),target);}
  changed.push({status,file});
}
// Include the newly added migration even before commit.
const migration='modules/nervous_breakdown/migrations/002_retire_empty_model.sql';
await copyFile(join(root,'platform',migration),join(stage,migration));
for(const rel of ['modules/nervous_breakdown/model.js','modules/nervous_breakdown/component.json','modules/nervous_breakdown/gap-overlay.json']) {
  await assert.rejects(access(join(stage,rel)));
}
await symlink(join(stage,'modules-runtime'),join(stage,'node_modules'),'junction');
try {
  execFileSync(process.execPath,[join(root,'scripts/principaled-clean-pass-e2e.cjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PRINCIPALED_VERIFY_PLATFORM:stage}});
} finally {await rmdir(join(stage,'node_modules'));}
const replacements=[];
for(const [id,source] of [['platform',stage],['launcher-ui',join(root,'apps/launcher/dist')]]) {
  const name=`${id}-${tag}.zip`,destination=join(out,name);
  execFileSync('tar.exe',['-a','-cf',destination,'-C',source,'.'],{windowsHide:true});
  const archive=await readFile(destination),sha256=hash(archive);
  replacements.push({id,version:sha256.slice(0,24),url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/${name}`,size:archive.length,sha256});
}
const latest=await publishedBaseline();assert.deepEqual(latest,baseline,'Release changed during packaging');
const manifest={...baseline,releaseVersion:tag,publishedAt:new Date().toISOString(),notes:'Remove the retired Nervous Breakdown responsibility model. Empty destination only; no replacement model. Unrelated app bundles preserved.',bundles:cumulativeBundles(baseline,replacements)};
await writeFile(join(out,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(out,'verification.json'),JSON.stringify({baseRelease:baseline.releaseVersion,base,baselineInventorySha256:hash(await readFile(join(out,'baseline-files.json'))),changed,stagedBrowserPassed:true,bundles:replacements},null,2)+'\n');
console.log(JSON.stringify({out,bundles:replacements}));
