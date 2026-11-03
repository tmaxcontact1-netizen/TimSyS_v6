import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
// Package a repaired platform stage using actual installed compatibility gates.
// Preserve nested node_modules directories: only generated root junctions are excluded.
// Exclude the retired bundled TradeEd backend; never modify installed files or gates.
const [stageArg,installedArg,manifestArg,outArg,release]=process.argv.slice(2);
assert.ok(stageArg&&installedArg&&manifestArg&&outArg&&/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release??''),'Supply stage, installed platform, baseline manifest, new output directory, release');
const stage=resolve(stageArg),installed=resolve(installedArg),out=resolve(outArg);
await mkdir(out);const extracted=join(out,'verified-platform');await mkdir(extracted);
const require=createRequire(import.meta.url),{UpdateManager}=require(join(installed,'native/desktop/update-manager.cjs'));
const updater=new UpdateManager({dataRoot:join(out,'isolated-updater-state'),currentLauncherVersion:'1.1.0',baselineFile:join(installed,'installed-baseline.json')});
await updater.validateBundle('platform',stage);
const filename='platform-'+release+'.zip',archive=join(out,filename);
const fileList=Object.keys(await inventory(stage)).sort();assert.ok(fileList.every(p=>!/[\r\n]/.test(p)));const listPath=join(out,'archive-files.txt');await writeFile(listPath,fileList.map(p=>'./'+p).join('\n')+'\n');
execFileSync('tar.exe',['-a','-cf',archive,'-C',stage,'-T',listPath],{windowsHide:true});
execFileSync('tar.exe',['-xf',archive,'-C',extracted],{windowsHide:true});
await updater.validateBundle('platform',extracted);
async function inventory(dir){const paths=[];async function visit(at,prefix=''){for(const e of await readdir(at,{withFileTypes:true})){if(e.isSymbolicLink()){assert.equal(e.name,'node_modules');continue;}const p=prefix+e.name;if(p==='services/tradeed')continue;if(e.isDirectory())await visit(join(at,e.name),p+'/');else paths.push(p);}}await visit(dir);const map={};for(let i=0;i<paths.length;i+=32)await Promise.all(paths.slice(i,i+32).map(async p=>{map[p]=createHash('sha256').update(await readFile(join(dir,p))).digest('hex');}));return map;}

const expected=await inventory(stage),actual=await inventory(extracted);const differences=[...new Set([...Object.keys(actual),...Object.keys(expected)])].filter(p=>actual[p]!==expected[p]);assert.equal(differences.length,0,'Archive differences: '+differences.slice(0,10).join(', '));
const gates=['main.cjs','update-manager.cjs','tradeed-sandbox-update-gate.cjs','tradeed-sandbox-contract.json','inspection-host-gateway.cjs','database-update-gate.cjs','database-isolation-contract.json','app-database-gateway.cjs'];
for(const name of gates)assert.ok((await readFile(join(installed,'native/desktop',name))).equals(await readFile(join(extracted,'native/desktop',name))),'Installed contract drift: '+name);
const bytes=await readFile(archive),sha256=createHash('sha256').update(bytes).digest('hex'),baseline=JSON.parse(await readFile(manifestArg,'utf8'));
const bundle={id:'platform',version:sha256.slice(0,24),url:'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/'+release+'/'+filename,size:bytes.length,sha256};
await writeFile(join(out,'timsys-update.json'),JSON.stringify({...baseline,releaseVersion:release,publishedAt:new Date().toISOString(),notes:'ResearchEd 0.10.14 runtime dependency repair: restores nested parser dependencies and stops the startup rollback loop. Verified with actual Electron backend startup and disposable database. No automatic analysis; TradeEd sandbox unchanged.',bundles:baseline.bundles.map(b=>b.id==='platform'?bundle:b)},null,2));
await writeFile(join(out,'verification.json'),JSON.stringify({release,nestedDependencyDirectoriesPreserved:true,installedUpdaterPassed:true,retainedFilesUnchanged:Object.keys(actual).length,installedContractsUnchanged:gates,excluded:'services/tradeed',liveFilesModified:false,bundle},null,2));
console.log(JSON.stringify({release,installedUpdaterPassed:true,retainedFilesUnchanged:Object.keys(actual).length,size:bytes.length}));
