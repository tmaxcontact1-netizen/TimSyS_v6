import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile,lstat,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// ResearchEd releases update only ResearchEd. Re-advertising historical shared
// bundles can downgrade a locally installed platform/assistant integration.
const [stageArg,baselineArg,verificationArg,outputArg,tag,mcfVerificationArg,guidedVerificationArg,simpleVerificationArg]=process.argv.slice(2);
assert.ok(stageArg&&baselineArg&&verificationArg&&outputArg&&/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(tag??''),'Usage: node scripts/package-researched-update.mjs STAGE BASELINE_MANIFEST VERIFICATION OUTPUT YYYY.MM.DD.N');
const stage=resolve(stageArg),output=resolve(outputArg);
const report=JSON.parse(await readFile(verificationArg,'utf8'));
assert.ok(report.checks.length>=12&&report.passedAt);
const digest=createHash('sha256');
for(const name of ['dist/src/entrypoints/api.js','dist/src/application/content-worker.js','dist/src/application/content-reader.js','dist/frontend/index.html'])digest.update(await readFile(join(stage,name)));
assert.equal(digest.digest('hex'),report.buildFingerprint,'Staged build must match full-path verification');
let mcfReport=null;
if(await lstat(join(stage,'dist/src/domain/mcf.js')).catch(()=>null)){assert.ok(mcfVerificationArg,'MCF runtime requires staged MCF verification');mcfReport=JSON.parse(await readFile(mcfVerificationArg,'utf8'));assert.ok(mcfReport.passedAt&&mcfReport.aiCalls===0);const structuralFiles=await lstat(join(stage,'dist/src/application/compiled-review.js')).catch(()=>null)?['dist/src/domain/compiled-review.js','dist/src/application/compiled-review.js','dist/analysis-config/compiled-review/1.0.json','migrations/0018_mcf_structural_mappings.sql']:[];const lifecycleFiles=await lstat(join(stage,'dist/src/infrastructure/mcf-lifecycle.js')).catch(()=>null)?['dist/src/infrastructure/mcf-lifecycle.js','migrations/0019_mcf_lifecycle.sql']:[];const mcfHash=createHash('sha256');for(const name of [...(await lstat(join(stage,'dist/src/application/mcf-ai.js')).catch(()=>null)?['dist/src/application/mcf-ai.js','dist/src/application/question-analysis.js','dist/analysis-config/mcf-classification/1.1.json','migrations/0020_mcf_ai_proposals.sql']:[]),...lifecycleFiles,...structuralFiles,'dist/src/domain/mcf.js','dist/src/application/mcf-import.js','dist/src/infrastructure/mcf-repository.js','dist/src/entrypoints/mcf-api.js','dist/src/entrypoints/api.js','dist/frontend/index.html','dist/instruments/mcf/1.0.json','dist/analysis-config/mcf-retrieval/1.0.json','migrations/0017_mcf_manual.sql'])mcfHash.update(await readFile(join(stage,name)));assert.equal(mcfHash.digest('hex'),mcfReport.buildFingerprint,'MCF build must match staged verification');}
let guidedReport=null;
if(await lstat(join(stage,'dist/src/application/mcf-ai.js')).catch(()=>null)){
 assert.ok(guidedVerificationArg,'AI workflow requires staged guided verification');
 guidedReport=JSON.parse(await readFile(guidedVerificationArg,'utf8'));assert.ok(guidedReport.passedAt&&guidedReport.externalModelCalls===0&&guidedReport.checks.length>=8);
 const files=['dist/src/application/ai-analysis.js','dist/src/application/source-acquisition.js','dist/src/domain/content-analysis.js','dist/src/application/mcf-ai.js','dist/src/application/question-analysis.js','dist/src/application/content-worker.js','dist/src/application/content-reader.js','dist/src/entrypoints/content-api.js','dist/src/entrypoints/mcf-api.js','dist/src/infrastructure/mcf-repository.js','dist/frontend/index.html','dist/analysis-config/mcf-classification/1.1.json','migrations/0020_mcf_ai_proposals.sql'];
 assert.deepEqual(guidedReport.fingerprintFiles,files);const proof=createHash('sha256');for(const file of files)proof.update(await readFile(join(stage,file)));assert.equal(proof.digest('hex'),guidedReport.buildFingerprint,'Guided build must match staged verification');
}
let simpleReport=null;
if(await lstat(join(stage,'dist/src/entrypoints/workbench-api.js')).catch(()=>null)){
 assert.ok(simpleVerificationArg,'Simple workflow requires its staged acceptance report');simpleReport=JSON.parse(await readFile(simpleVerificationArg,'utf8'));assert.ok(simpleReport.passedAt&&simpleReport.externalModelCalls===0&&simpleReport.checks.length>=11);
 const files=['dist/src/application/mcf-deterministic.js','dist/analysis-config/mcf-deterministic/1.0.json','dist/src/application/mcf-report.js','dist/src/domain/draft-history.js','dist/src/entrypoints/workbench-api.js','dist/src/entrypoints/api.js','dist/src/infrastructure/mcf-repository.js','dist/src/infrastructure/content-repository.js','dist/frontend/index.html','migrations/0021_guided_workbench.sql','dist/src/infrastructure/workbench-delete.js','migrations/0023_workbench_deletion_and_dates.sql'];assert.deepEqual(simpleReport.fingerprintFiles,files);const proof=createHash('sha256');for(const file of files)proof.update(await readFile(join(stage,file)));assert.equal(proof.digest('hex'),simpleReport.buildFingerprint,'Simple workflow must match staged verification');
}
const junction=join(stage,'node_modules');
const info=await lstat(junction).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
if(info){assert.ok(info.isSymbolicLink(),'Only the temporary verification junction may be removed');await unlink(junction);}
const hash=createHash('sha256');
async function walk(directory,prefix=''){for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){assert.ok(!entry.isSymbolicLink(),'Runtime archive must not contain symbolic links');const relative=prefix+entry.name,path=join(directory,entry.name);if(entry.isDirectory())await walk(path,relative+'/');else hash.update(relative).update('\0').update(await readFile(path)).update('\0');}}
await walk(stage);const version=hash.digest('hex').slice(0,24);
await mkdir(output,{recursive:true});const filename=`researched-${tag}.zip`,archive=join(output,filename);
execFileSync('tar.exe',['-a','-cf',archive,'-C',stage,'.'],{windowsHide:true});
const bytes=await readFile(archive),sha256=createHash('sha256').update(bytes).digest('hex');
const baseline=JSON.parse(await readFile(baselineArg,'utf8'));
const bundle={id:'researched',version,url:`https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${tag}/${filename}`,size:bytes.length,sha256};
const manifest={...baseline,releaseVersion:tag,publishedAt:new Date().toISOString(),notes:process.env.RESEARCHED_RELEASE_NOTES??'Research’Ed: document link intake, deterministic curriculum and professional-development evidence, supporting documents, source failures and optional cited AI notes.',bundles:[bundle]};
await writeFile(join(output,'timsys-update.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(output,'researched-verification.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),bundle,workflow:report,mcf:mcfReport,guided:guidedReport,simple:simpleReport},null,2)+'\n');
console.log(JSON.stringify({archive,bundle,retainedBundles:manifest.bundles.filter(b=>b.id!=='researched').map(b=>b.id)},null,2));
