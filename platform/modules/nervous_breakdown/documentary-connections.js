'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
// Invoke the existing Research'Ed projection; never copy, extend or reimplement its grammar.
async function frozenMatrix() {
  if(process.env.NODE_ENV==='test'&&process.env.NB_FROZEN_JD_MATRIX)
    return import(pathToFileURL(path.resolve(process.env.NB_FROZEN_JD_MATRIX)).href);
  if(!process.env.DB_PATH)throw Error('The frozen documentary projection is unavailable.');
  const dataRoot=path.resolve(path.dirname(process.env.DB_PATH),'..');
  const state=JSON.parse(await fs.readFile(path.join(dataRoot,'updates/state.json'),'utf8'));
  const bundle=await fs.realpath(state.bundles?.researched?.path||'');
  const allowed=await fs.realpath(path.join(dataRoot,'updates/bundles/researched'));
  if(!bundle.startsWith(allowed+path.sep))throw Error('The Research’Ed runtime is outside the registered bundle store.');
  return import(pathToFileURL(path.join(bundle,'dist/src/domain/jd-matrix.js')).href);
}
const key=value=>value.trim().replace(/\s+/g,' ').toLowerCase();
async function connections(data,documentId,passageId) {
  const {jdMatrix}=await frozenMatrix();
  const matrix=jdMatrix(data.documents,data.review);
  if(matrix.contract!=='researched.jd-matrix.v1')throw Error('Unsupported frozen documentary projection.');
  const row=matrix.rows.find(r=>r.documentId===documentId&&r.id===passageId);
  if(!row)throw Error('The selected statement is not in the reviewed documentary projection.');
  const document=data.documents.find(d=>d.id===documentId);
  if(document.extracted.slice(row.start,row.end)!==row.text)throw Error('The selected statement failed its retained source check.');
  // Exact title identity only (the same whitespace/case rule used by the frozen
  // reporting projection). Researcher equivalences are audit-only in this engine.
  const records=matrix.documentedRelationships.filter(r=>r.documentId===documentId&&r.passageId===passageId).map(r=>{
    const targets=data.documents.filter(d=>key(data.review.roles[d.id]||d.role||'')===key(r.counterpart));
    return {...r,resolvedDocumentId:targets.length===1?targets[0].id:null,
      resolution:targets.length===1?'exact_documentary_title':targets.length>1?'ambiguous_documentary_title':'no_exact_documentary_title'};
  });
  return {records,projection:'researched.jd-matrix.v1',equivalencePolicy:'Audit-only declarations; no equivalence routing is supplied by the frozen projection.'};
}
module.exports={connections};
