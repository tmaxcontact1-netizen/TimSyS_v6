import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
// Repackage a verified platform stage using the actual installed compatibility gates.
// Exclude the retired bundled TradeEd backend; never modify installed files or gates.
const [stageArg,installedArg,manifestArg,outArg,release]=process.argv.slice(2);
assert.ok(stageArg&&installedArg&&manifestArg&&outArg&&/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release??''),'Supply stage, installed platform, baseline manifest, new output directory, release');
const stage=resolve(stageArg),installed=resolve(installedArg),out=resolve(outArg);
await mkdir(out);const extracted=join(out,'verified-platform');await mkdir(extracted);
const require=createRequire(import.meta.url),{UpdateManager}=require(join(installed,'native/desktop/update-manager.cjs'));
const updater=new UpdateManager({dataRoot:join(out,'isolated-updater-state'),currentLauncherVersion:'1.1.0',baselineFile:join(installed,'installed-baseline.json')});
await assert.rejects(()=>updater.validateBundle('platform',stage),/TRADEED_BACKEND_REINTRODUCTION_DENIED/);
const filename='platform-'+release+'.zip',archive=join(out,filename);
execFileSync('tar.exe',['-a','-cf',archive,'--exclude=./services/tradeed','--exclude=services/tradeed','-C',stage,'.'],{windowsHide:true});
execFileSync('tar.exe',['-xf',archive,'-C',extracted],{windowsHide:true});
await updater.validateBundle('platform',extracted);
async function inventory(dir,prefix=''){const map={};for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='node_modules')continue;const p=prefix+e.name;if(p==='services/tradeed')continue;assert.ok(!e.isSymbolicLink());if(e.isDirectory())Object.assign(map,await inventory(join(dir,e.name),p+'/'));else map[p]=createHash('sha256').update(await readFile(join(dir,e.name))).digest('hex');}return map;}
const expected=await inventory(stage),actual=await inventory(extracted);assert.deepEqual(actual,expected,'Repack changed a retained file');
const gates=['main.cjs','update-manager.cjs','tradeed-sandbox-update-gate.cjs','tradeed-sandbox-contract.json','inspection-host-gateway.cjs','database-update-gate.cjs','database-isolation-contract.json','app-database-gateway.cjs'];
for(const name of gates)assert.ok((await readFile(join(installed,'native/desktop',name))).equals(await readFile(join(extracted,'native/desktop',name))),'Installed contract drift: '+name);
const bytes=await readFile(archive),sha256=createHash('sha256').update(bytes).digest('hex'),baseline=JSON.parse(await readFile(manifestArg,'utf8'));
const bundle={id:'platform',version:sha256.slice(0,24),url:'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/'+release+'/'+filename,size:bytes.length,sha256};
await writeFile(join(out,'timsys-update.json'),JSON.stringify({...baseline,releaseVersion:release,publishedAt:new Date().toISOString(),notes:'ResearchEd 0.10.14 packaging correction: excludes retired bundled TradeEd backend; passes installed TradeEd sandbox and database-isolation gates. Principal ingestion unchanged. No automatic analysis.',bundles:baseline.bundles.map(b=>b.id==='platform'?bundle:b)},null,2));
await writeFile(join(out,'verification.json'),JSON.stringify({release,oldPackageRejected:true,installedUpdaterPassed:true,retainedFilesUnchanged:Object.keys(actual).length,installedContractsUnchanged:gates,excluded:'services/tradeed',liveFilesModified:false,bundle},null,2));
console.log(JSON.stringify({release,installedUpdaterPassed:true,retainedFilesUnchanged:Object.keys(actual).length,size:bytes.length}));
