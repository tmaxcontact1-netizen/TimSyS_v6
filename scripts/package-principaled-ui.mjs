import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {publishedBaseline,cumulativeBundles} from './update-manifest-merge.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const [tag,reviewedUiVersion,verificationPath]=process.argv.slice(2);
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
assert.ok(reviewedUiVersion && verificationPath,'Pass the reviewed baseline UI version and successful browser report');
const verification=JSON.parse(await readFile(verificationPath,'utf8'));assert.equal(verification.passed,true);
const baseline=await publishedBaseline();
assert.equal(baseline.bundles.find(b=>b.id==='launcher-ui')?.version,reviewedUiVersion,'Published UI changed; review before replacing it');
const output=join(root,'dist-updates',`principaled-ui-${tag}`);await mkdir(output);
// Verify with the updater actually installed on this desktop, not this branch's
// potentially older implementation. Never bypass an installed compatibility guard.
const require=createRequire(import.meta.url);
const asar=require('../apps/launcher/node_modules/@electron/asar');
const nativeSource=asar.extractFile(join(process.env.LOCALAPPDATA,'Programs/TimSyS Launcher/resources/app.asar'),'electron/update-manager.cjs');
const nativePath=join(output,'installed-update-manager.cjs');
await writeFile(nativePath,nativeSource);
const {UpdateManager}=require(nativePath);
const manager=new UpdateManager({dataRoot:join(process.env.APPDATA,'timsys-launcher'),currentLauncherVersion:'1.0.20',manifestUrl:'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/latest/download/timsys-update.json'});
await manager.validateBundle('launcher-ui',join(root,'apps/launcher/dist'));
const filename=`launcher-ui-${tag}.zip`,zip=join(output,filename);
execFileSync('tar.exe',['-a','-cf',zip,'-C',join(root,'apps/launcher/dist'),'.'],{windowsHide:true});
const bytes=await readFile(zip),sha256=createHash('sha256').update(bytes).digest('hex');
const replacement={id:'launcher-ui',version:sha256.slice(0,24),url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/${filename}`,size:bytes.length,sha256};
const latest=await publishedBaseline();
assert.equal(latest.bundles.find(b=>b.id==='launcher-ui')?.version,reviewedUiVersion,'Published UI changed during packaging');
const manifest={...latest,releaseVersion:tag,publishedAt:new Date().toISOString(),notes:'Restore UI update compatibility: preserve the installed AI assistant and connection settings alongside the empty Nervous Breakdown destination. UI-only repair; no backend, data or native launcher changes.',bundles:cumulativeBundles(latest,[replacement])};
await writeFile(join(output,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,'principaled-verification.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baselineRelease:latest.releaseVersion,previousUiVersion:reviewedUiVersion,installedGuardSha256:createHash('sha256').update(nativeSource).digest('hex'),installedGuardPassed:true,checks:verification.checks,browserErrors:verification.browserErrors,syntheticOnly:true,workingDatabaseTouched:false,resetIncluded:false,bundle:replacement,retainedBundles:manifest.bundles.filter(b=>b.id!=='launcher-ui')},null,2)+'\n');
console.log(JSON.stringify({output,bundle:replacement,retained:manifest.bundles.filter(b=>b.id!=='launcher-ui').map(b=>({id:b.id,version:b.version}))},null,2));
