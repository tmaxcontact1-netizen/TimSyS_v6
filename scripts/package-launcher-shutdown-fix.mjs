// Native patch: preserve the installed launcher byte-for-byte except the reviewed manager.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),asar=require('../apps/launcher/node_modules/@electron/asar');
const root=process.cwd(),tag=process.argv[2];
assert.match(tag||'',/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
const baseline=path.join(process.env.LOCALAPPDATA,'Programs/TimSyS Launcher/resources/app.asar');
const out=path.join(root,'dist-updates',`launcher-shutdown-${tag}`),stage=path.join(out,'stage');
fs.mkdirSync(out);fs.mkdirSync(stage);
const hash=b=>createHash('sha256').update(b).digest('hex');
const beforeBytes=fs.readFileSync(baseline),baselineSha256=hash(beforeBytes);
const manager='electron/local-postgres-manager.cjs';
const old=execFileSync('git',['show',`HEAD^:apps/launcher/${manager}`],{encoding:'utf8'});
assert.equal(asar.extractFile(baseline,manager).toString().replaceAll('\r\n','\n'),old.replaceAll('\r\n','\n'),'Installed manager differs from reviewed baseline');
asar.extractAll(baseline,stage);
fs.copyFileSync(path.join(root,'apps/launcher',manager),path.join(stage,manager));
const payload=path.join(out,'app.asar');
await asar.createPackage(stage,payload);
const files=asar.listPackage(baseline).map(f=>f.replace(/^[/\\]/,'')).filter(f=>!asar.statFile(baseline,f).files);
assert.deepEqual(asar.listPackage(payload).sort(),asar.listPackage(baseline).sort());
const changed=files.filter(f=>!asar.extractFile(baseline,f).equals(asar.extractFile(payload,f)));
assert.deepEqual(changed.map(f=>f.replaceAll('\\','/')),[manager]);
assert.equal(hash(fs.readFileSync(baseline)),baselineSha256,'Installed launcher changed during packaging');
fs.copyFileSync(path.join(root,'scripts/install-launcher-shutdown-fix.ps1'),path.join(out,'Install-Shutdown-Fix.ps1'));
fs.writeFileSync(path.join(out,'native-patch.json'),JSON.stringify({
  release:tag,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  baselineSha256,patchedSha256:hash(fs.readFileSync(payload)),changedFiles:[manager],preservedFiles:files.length-1,
  applicationDataChanged:false,automaticBundleUpdaterSupported:false,
},null,2));
execFileSync('tar.exe',['-a','-cf',path.join(out,`TimSyS-Launcher-Shutdown-Fix-${tag}.zip`),'-C',out,'app.asar','native-patch.json','Install-Shutdown-Fix.ps1'],{windowsHide:true});
console.log(fs.readFileSync(path.join(out,'native-patch.json'),'utf8'));
