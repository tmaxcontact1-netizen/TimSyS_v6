import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile,symlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publishedBaseline,cumulativeBundles} from './update-manifest-merge.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),tag=process.argv[2],baseCommit=process.argv[3];
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
assert.match(baseCommit||'',/^[a-f0-9]{7,40}$/);
const output=join(root,'dist-updates',`principaled-${tag}`),stage=join(output,'platform');
await mkdir(output,{recursive:true});await mkdir(stage); // Refuse to reuse a prior stage.
const baseline=await publishedBaseline(),base=baseline.bundles.find(b=>b.id==='platform');assert.ok(base);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const response=await fetch(base.url);assert.ok(response.ok,'Published platform download failed');
const archive=Buffer.from(await response.arrayBuffer());assert.equal(hash(archive),base.sha256);assert.equal(archive.length,base.size);
await writeFile(join(output,'baseline-platform.zip'),archive);
execFileSync('tar.exe',['-xf',join(output,'baseline-platform.zip'),'-C',stage],{windowsHide:true});
// This narrow release changes one backend source file. Keep every other file,
// dependency and migration from the verified published platform unchanged.
const changed='modules/nervous_breakdown/index.js';
const previous=execFileSync('git',['show',`${baseCommit}:platform/${changed}`],{cwd:root,encoding:'utf8'});
assert.equal((await readFile(join(stage,changed),'utf8')).replaceAll('\r\n','\n'),previous.replaceAll('\r\n','\n'),'Published backend differs from the reviewed source base');
await copyFile(join(root,'platform',changed),join(stage,changed));
await symlink(join(stage,'modules-runtime'),join(stage,'node_modules'),'junction');
try {
  execFileSync(process.execPath,[join(root,'scripts/principaled-clean-pass-e2e.cjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PRINCIPALED_VERIFY_PLATFORM:stage}});
} finally {await rmdir(join(stage,'node_modules'));}

const replacements=[];
for(const [id,source] of [['platform',stage],['launcher-ui',join(root,'apps/launcher/dist')]]) {
  const filename=`${id}-${tag}.zip`,destination=join(output,filename);
  execFileSync('tar.exe',['-a','-cf',destination,'-C',source,'.'],{windowsHide:true});
  const bytes=await readFile(destination),sha256=hash(bytes);
  replacements.push({id,version:sha256.slice(0,24),url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/${filename}`,size:bytes.length,sha256});
}
const latest=await publishedBaseline();
assert.deepEqual(latest.bundles.find(b=>b.id==='platform'),base,'Platform changed during packaging; rebuild against the new baseline');
const manifest={...latest,releaseVersion:tag,publishedAt:new Date().toISOString(),notes:'Principal’Ed clean working pass: named record selection and removal of synthetic dataset controls. This update does not delete application data.',bundles:cumulativeBundles(latest,replacements)};
await writeFile(join(output,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,'principaled-verification.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baseline:base,backendReplacement:changed,backendSha256:hash(await readFile(join(stage,changed))),stagedBrowserVerification:true,resetIncluded:false,bundles:replacements},null,2)+'\n');
console.log(JSON.stringify({output,bundles:replacements,retained:manifest.bundles.filter(b=>!replacements.some(r=>r.id===b.id)).map(b=>b.id)},null,2));
