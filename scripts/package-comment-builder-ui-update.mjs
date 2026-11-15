// UI-only update. Preserve all other published bundles; never install or restart.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve,relative,sep} from 'node:path';
import {createRequire} from 'node:module';
import {publishedBaseline,cumulativeBundles} from './update-manifest-merge.mjs';
const root=resolve(import.meta.dirname,'..'),tag=process.argv[2];
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
const out=join(root,'dist-updates','comment-builder-'+tag);await mkdir(out,{recursive:true});
const baseline=await publishedBaseline(),ui=join(root,'apps/launcher/dist');
const sha=data=>createHash('sha256').update(data).digest('hex');
async function inventory(dir){const result={};for(const e of await readdir(dir,{recursive:true,withFileTypes:true})){assert.ok(!e.isSymbolicLink());if(e.isFile()){const file=join(e.parentPath,e.name);result[relative(dir,file).split(sep).join('/')]=sha(await readFile(file));}}return result;}
assert.deepEqual(await inventory(join(ui,'comment-builder')),await inventory(join(root,'apps/principaled/public/comment-builder')));
assert.deepEqual(await inventory(join(ui,'observation-studio')),await inventory(join(root,'apps/principaled/public/observation-studio')));
const installed=JSON.parse(await readFile(join(process.env.APPDATA,'timsys-launcher/updates/state.json'),'utf8'));
const require=createRequire(import.meta.url),{UpdateManager}=require(join(installed.bundles.platform.path,'native/desktop/update-manager.cjs'));
const manager=new UpdateManager({dataRoot:join(process.env.APPDATA,'timsys-launcher'),currentLauncherVersion:'1.1.0',baselineFile:join(installed.bundles.platform.path,'installed-baseline.json')});
await manager.validateBundle('launcher-ui',ui);
const zip=join(out,`launcher-ui-${tag}.zip`);execFileSync('tar.exe',['-a','-cf',zip,'-C',ui,'.'],{windowsHide:true});
const extracted=join(out,'verified-launcher-ui');await mkdir(extracted);execFileSync('tar.exe',['-xf',zip,'-C',extracted],{windowsHide:true});
assert.deepEqual(await inventory(extracted),await inventory(ui));await manager.validateBundle('launcher-ui',extracted);
const bytes=await readFile(zip),digest=sha(bytes),replacement={id:'launcher-ui',version:digest.slice(0,24),sha256:digest,size:bytes.length,url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/launcher-ui-${tag}.zip`};
assert.deepEqual(await publishedBaseline(),baseline,'Published baseline changed during packaging.');
const manifest={...baseline,releaseVersion:tag,publishedAt:new Date().toISOString(),notes:'Principal’Ed Comment Builder: previous/next student navigation, live unsaved bank previews, improved lowercase-pronoun contradiction detection, cancellable full-bank checks and deterministic fallback when grammar is unavailable. UI-only; backend, saved data, Trade’Ed, Research’Ed and Dress’Ed preserved.',bundles:cumulativeBundles(baseline,[replacement])};
const verification={release:tag,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baselineRelease:baseline.releaseVersion,installedGuardsPassed:true,archiveRoundTripPassed:true,liveStateModified:false,retainedBundles:manifest.bundles.filter(b=>b.id!=='launcher-ui'),replacement};
for(const [name,value]of [['baseline-manifest.json',baseline],['timsys-update.json',manifest],['comment-builder-ui-verification.json',verification]])await writeFile(join(out,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(verification,null,2));
