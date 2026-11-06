const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{compatibleRoots}=require('./central-bundles.cjs');
test('legacy bundles cannot override host; independently compatible Dress frontend remains usable',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'central-bundle-'));
 try{const platform=path.join(root,'platform'),dressed=path.join(root,'dressed');fs.mkdirSync(platform);fs.mkdirSync(dressed);
 fs.writeFileSync(path.join(dressed,'timsys.app.json'),JSON.stringify({kind:'supervised-child'}));assert.deepEqual(compatibleRoots({platform,dressed,'launcher-ui':'UI'}),{});
 fs.mkdirSync(path.join(platform,'services'));fs.writeFileSync(path.join(platform,'services/domain-services.json'),'{}');
 fs.writeFileSync(path.join(dressed,'timsys.app.json'),JSON.stringify({kind:'frontend',backend:{owner:'timsys',version:'1.0.0'}}));
 assert.deepEqual(compatibleRoots({platform,dressed}),{dressed},'Registry alone cannot bypass the sandbox contract');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
