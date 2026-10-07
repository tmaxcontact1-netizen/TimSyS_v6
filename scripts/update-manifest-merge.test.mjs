import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cumulativeBundles} from './update-manifest-merge.mjs';
const bundle=(id,version)=>({id,version,url:`https://example.test/${id}-${version}.zip`,sha256:'a'.repeat(64),size:100});
test('a launcher-only release retains ResearchEd and other app updates verbatim',()=>{
 const baseline={schemaVersion:1,bundles:[bundle('platform','p'),bundle('researched','new-ui'),bundle('launcher-ui','old')]};
 const launcher=bundle('launcher-ui','new');
 assert.deepEqual(cumulativeBundles(baseline,[launcher]),[baseline.bundles[0],baseline.bundles[1],launcher]);
 assert.equal(baseline.bundles[2].version,'old');
});
test('new applications are appended while existing replacements occur once',()=>{
 const old=bundle('platform','old'),next=bundle('platform','new'),app=bundle('researched','new');
 assert.deepEqual(cumulativeBundles({schemaVersion:1,bundles:[old]},[next,app]),[next,app]);
});
test('missing or ambiguous baseline fails instead of silently dropping apps',()=>{
 assert.throws(()=>cumulativeBundles({},[]));
 const b=bundle('researched','new');assert.throws(()=>cumulativeBundles({schemaVersion:1,bundles:[b,b]},[]));
 assert.throws(()=>cumulativeBundles({schemaVersion:1,bundles:[]},[b,b]));
});
