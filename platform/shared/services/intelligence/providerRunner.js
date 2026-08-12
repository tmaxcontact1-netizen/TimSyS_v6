'use strict';
var crypto = require('crypto');
var db = require('../db');
var providers = new Map();
function register(provider) {
  if (!provider || !provider.id || !provider.version || typeof provider.analyse !== 'function') throw new Error('Provider requires id, version and analyse');
  var governance=provider.governance;if(!governance||!Array.isArray(governance.inputs)||!governance.inputs.length||!Array.isArray(governance.outputs)||!governance.outputs.length||!governance.minimumEvidence||!governance.confidenceMethod||!governance.failureMode)throw new Error('Provider '+provider.id+' has an incomplete governance declaration');
  providers.set(provider.id, provider); return provider.id;
}
async function run(providerId, options) {
  options = options || {}; var provider = providers.get(providerId); if (!provider) throw new Error('Unknown provider: ' + providerId);
  var now = Date.now(); var end = options.to || now; var start = options.from || end - 90 * 86400000; var duration = end - start; var comparisonEnd = options.comparisonEnd == null ? start - 1 : options.comparisonEnd; var comparisonStart = options.comparisonStart == null ? comparisonEnd - duration : options.comparisonStart;
  if (!(start < end) || !(comparisonStart < comparisonEnd)) throw new Error('Provider periods are invalid');
  var scope = options.scope || { type: 'organisation', id: 'current' }; var id = crypto.randomUUID();
  db.query('INSERT INTO provider_runs (id,provider_id,provider_version,scope_type,scope_id,period_start,period_end,comparison_start,comparison_end,status,started_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, provider.id, provider.version, scope.type, String(scope.id), start, end, comparisonStart, comparisonEnd, 'running', now]);
  try {
    var result = await provider.analyse({ runId: id, scope: scope, period: { start: start, end: end }, comparison: { start: comparisonStart, end: comparisonEnd }, options: options });
    db.query("UPDATE provider_runs SET status='completed', input_summary=?, output_summary=?, completed_at=? WHERE id=?", [JSON.stringify({ scope: scope, period: { start:start,end:end }, comparison:{ start:comparisonStart,end:comparisonEnd } }), JSON.stringify(result), Date.now(), id]); return Object.assign({ runId: id, providerId: provider.id, providerVersion: provider.version }, result);
  } catch (error) { db.query("UPDATE provider_runs SET status='failed', error=?, completed_at=? WHERE id=?", [error.message, Date.now(), id]); throw error; }
}
module.exports = { register: register, run: run, list: function() { return Array.from(providers.values()).map(function(p) { return { id:p.id, version:p.version, governance:p.governance }; }); } };
