'use strict';
// A read-only bridge to the existing documentary store. No extraction, import or database writes.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function root() {
  if (process.env.NB_DOCUMENTARY_ROOT) return path.resolve(process.env.NB_DOCUMENTARY_ROOT);
  if (process.env.NODE_ENV === 'test' || !process.env.DB_PATH) return null;
  return path.resolve(path.dirname(process.env.DB_PATH), '../researched/private-storage/jd-responsibilities');
}
function failure(message, statusCode = 409) {
  return {success:false, statusCode, error:{code:'DOCUMENTARY_SOURCE_UNAVAILABLE', message}};
}
async function project(id) {
  if (!uuid.test(id || '') || !root()) throw Error('Document collection is unavailable.');
  const base = await fs.realpath(root());
  const file = await fs.realpath(path.join(base, id, 'project.json'));
  if (!file.startsWith(base + path.sep)) throw Error('Document collection is outside the source store.');
  const bytes = await fs.readFile(file);
  const data = JSON.parse(bytes);
  if (data.id !== id || !Array.isArray(data.documents) || !data.review) throw Error('Document collection is not a supported JD snapshot.');
  return {data, revision:crypto.createHash('sha256').update(bytes).digest('hex')};
}
async function collections() {
  if (!root()) return {success:true, collections:[]};
  try {
    const entries = await fs.readdir(root(), {withFileTypes:true});
    const items = [];
    for (const entry of entries.filter(e => e.isDirectory() && uuid.test(e.name))) {
      const {data,revision} = await project(entry.name);
      items.push({id:data.id,title:data.title,revision,documentCount:data.documents.length});
    }
    return {success:true,collections:items.sort((a,b) => a.id.localeCompare(b.id))};
  } catch (e) {
    if (e.code === 'ENOENT') return {success:true,collections:[]};
    return failure('The documentary store could not be read. No source data has been changed.');
  }
}
async function landscape(req) {
  try {
    const {data,revision} = await project(req.params.id);
    for (const d of data.documents) {
      if (!uuid.test(d.id) || !Array.isArray(d.passages) || typeof d.extracted !== 'string') throw Error('Unsupported documentary structure.');
      for (const p of d.passages) {
        if (d.extracted.slice(p.start,p.end) !== p.text) throw Error('A source passage does not match its retained documentary text. Check it in Research’Ed.');
      }
    }
    // Relationships, analysis, undo/history and complete extracted documents never enter the landscape.
    return {success:true,snapshot:{id:data.id,title:data.title,revision,
      review:{roles:data.review.roles,excluded:data.review.excluded,structure:data.review.structure},
      documents:data.documents.map(d => ({id:d.id,filename:d.filename,sha256:d.sha256,role:d.role,passages:d.passages}))}};
  } catch (e) { return failure(e.message); }
}
async function source(req) {
  try {
    const {data,revision} = await project(req.params.id);
    if (req.query.revision !== revision) return failure('The documentary collection changed. Reload the landscape before viewing its source.');
    const d = data.documents.find(d => d.id === req.params.documentId);
    const p = d?.passages.find(p => p.id === req.params.passageId);
    if (!p) return failure('Source passage not found.',404);
    if (d.extracted.slice(p.start,p.end) !== p.text) return failure('The retained passage failed its source integrity check.');
    const start = Math.max(0,p.start-650), end = Math.min(d.extracted.length,p.end+650);
    return {success:true,source:{filename:d.filename,location:p.location,sha256:d.sha256,
      before:d.extracted.slice(start,p.start),text:p.text,after:d.extracted.slice(p.end,end),
      startTruncated:start>0,endTruncated:end<d.extracted.length,revision}};
  } catch (e) { return failure(e.message); }
}
module.exports = {boot(ctx) {ctx.log.info('Nervous Breakdown: read-only documentary landscape');},teardown(){},collections,landscape,source};
