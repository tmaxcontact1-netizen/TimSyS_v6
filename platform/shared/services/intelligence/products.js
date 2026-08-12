'use strict';
var crypto = require('crypto');
var db = require('../db');
var TYPES = ['observation','alert','reminder','recommendation','data_quality'];
var SEVERITIES = ['positive','information','warning','critical'];
var ACTION_STATUS = { presented: 'presented', acknowledged: 'acknowledged', accepted: 'accepted', rejected: 'rejected', deferred: 'deferred', dismissed: 'dismissed', actioned: 'actioned', resolved: 'resolved', reopened: 'detected', superseded: 'superseded' };
function json(value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback; } }
function format(row) { return Object.assign({}, row, { evidence: json(row.evidence, []), knowledgeRefs: json(row.knowledge_refs, []), possibleActions: json(row.possible_actions, []), audience: json(row.audience, []) }); }
function validate(product) {
  if (TYPES.indexOf(product.type) < 0) throw new Error('Invalid insight product type');
  if (!product.scope || !product.scope.type || product.scope.id == null) throw new Error('Insight scope is required');
  if (!product.title || !product.summary || !product.providerId || !product.providerVersion) throw new Error('Insight title, summary and provider identity are required');
  if (product.severity && SEVERITIES.indexOf(product.severity) < 0) throw new Error('Invalid insight severity');
  if (product.severity === 'positive' && product.type !== 'observation') throw new Error('Positive signals must be factual observations');
  if (!Array.isArray(product.evidence) || product.evidence.length === 0) throw new Error('An insight product requires traceable evidence');
  if (product.confidence != null && product.confidence < 1 && !product.uncertainty) product.uncertainty = 'Confidence is limited by the amount and quality of currently recorded source data.';
}
function fingerprint(product) { return product.fingerprint || crypto.createHash('sha256').update([product.providerId, product.providerVersion, product.type, product.scope.type, product.scope.id, product.title, JSON.stringify(product.evidence)].join('|')).digest('hex'); }
module.exports = {
  create: function(product) {
    validate(product); var id = product.id || crypto.randomUUID(); var now = Date.now();
    var fp = fingerprint(product); var existing = db.query("SELECT id FROM insight_products WHERE fingerprint=? AND status NOT IN ('resolved','superseded','expired')", [fp]).rows; if (existing.length) return existing[0].id;
    db.query('INSERT INTO insight_products (id, product_type, scope_type, scope_id, title, summary, explanation, evidence, knowledge_refs, possible_actions, confidence, uncertainty, severity, status, audience, provider_id, provider_version, detected_at, review_at, expires_at, provider_run_id, fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, product.type, product.scope.type, String(product.scope.id), product.title, product.summary, product.explanation || null, JSON.stringify(product.evidence), JSON.stringify(product.knowledgeRefs || []), JSON.stringify(product.possibleActions || []), product.confidence == null ? 0 : product.confidence, product.uncertainty || null, product.severity || 'information', 'detected', JSON.stringify(product.audience || []), product.providerId, product.providerVersion, product.detectedAt || now, product.reviewAt || null, product.expiresAt || null, product.providerRunId || null, fp]); return id;
  },
  act: function(id, action, actorId, options) {
    options = options || {}; if (!ACTION_STATUS[action]) throw new Error('Invalid insight action');
    return db.transaction(function(tx) { var found = tx.query('SELECT id FROM insight_products WHERE id = ?', [id]); if (!found.rows.length) throw new Error('Insight not found'); tx.query('INSERT INTO insight_actions (insight_id, action, actor_id, rationale, metadata, acted_at) VALUES (?, ?, ?, ?, ?, ?)', [id, action, actorId, options.rationale || null, JSON.stringify(options.metadata || {}), Date.now()]); tx.query('UPDATE insight_products SET status = ? WHERE id = ?', [ACTION_STATUS[action], id]); return true; });
  },
  get: function(id) { var rows = db.query('SELECT * FROM insight_products WHERE id = ?', [id]).rows; if (!rows.length) return null; var product = format(rows[0]); product.actions = db.query('SELECT * FROM insight_actions WHERE insight_id = ? ORDER BY acted_at', [id]).rows; return product; },
  list: function(scopeType, scopeId) { return db.query('SELECT * FROM insight_products WHERE scope_type = ? AND scope_id = ? ORDER BY detected_at DESC', [scopeType, String(scopeId)]).rows.map(format); },
  listVisible: function(scopeType,scopeId,viewerRole){return this.list(scopeType,scopeId).filter(function(item){return !item.audience.length||item.audience.indexOf('all')>=0||item.audience.indexOf(viewerRole)>=0;});},
  portfolio: function(scopeType, scopeId,viewerRole) { var items=viewerRole?this.listVisible(scopeType,scopeId,viewerRole):this.list(scopeType,scopeId),groups={positive:[],attention:[],neutral:[]};items.forEach(function(item){if(item.severity==='positive')groups.positive.push(item);else if(['warning','critical'].indexOf(item.severity)>=0)groups.attention.push(item);else groups.neutral.push(item);});return {counts:{positive:groups.positive.length,attention:groups.attention.length,neutral:groups.neutral.length,total:items.length},positive:groups.positive,attention:groups.attention,neutral:groups.neutral}; },
  types: TYPES.slice()
};
