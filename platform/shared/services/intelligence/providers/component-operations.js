'use strict';

const db = require('../../db');
const componentRegistry = require('../../../registry/componentRegistry');
const metrics = require('../metrics');
const products = require('../products');

const ID = 'core.component-operations';
const VERSION = '1.0.0';

function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value || '')) throw new Error('Unsafe component intelligence identifier');
  return value;
}

function analyse(context) {
  const summary = {};
  const created = [];
  for (const component of componentRegistry.getAll()) {
    const entities = component.intelligence?.entities || [];
    let total = 0;
    const entityEvidence = [];
    for (const declaration of entities) {
      const table = identifier(declaration.source.table);
      const type = identifier(declaration.type);
      const count = Number(db.scalar(`SELECT COUNT(*) FROM ${table}`) || 0);
      total += count;
      const statuses = {};
      if (declaration.statusField) {
        const statusField = identifier(declaration.statusField);
        for (const row of db.query(`SELECT ${statusField} status, COUNT(*) count FROM ${table} GROUP BY ${statusField}`).rows) {
          statuses[String(row.status ?? 'unrecorded')] = Number(row.count);
        }
      }
      entityEvidence.push({ kind: 'component_entity_summary', component: component.name, entityType: type, table, count, statuses });
    }
    summary[component.name] = { records: total, entities: entityEvidence.length };
    metrics.define({ id: `component.${component.name}.records`, name: `${component.name} records`, description: 'Current records declared by the component intelligence contract', unit: 'records', scopeTypes: ['organisation'], providerId: ID, providerVersion: VERSION });
    metrics.record({ metricId: `component.${component.name}.records`, scope: context.scope, period: context.period, value: total, evidence: entityEvidence, providerRunId: context.runId });
    if (!total) continue;
    created.push(products.create({
      type: 'observation', scope: context.scope,
      title: `${component.name.replaceAll('_', ' ')} operational footprint`,
      summary: `${total} current record${total === 1 ? '' : 's'} contribute across ${entityEvidence.length} declared data source${entityEvidence.length === 1 ? '' : 's'}.`,
      explanation: 'This is a factual component-level activity summary. Status counts describe recorded workflow state and do not judge performance or cause.',
      evidence: entityEvidence,
      possibleActions: ['Open the relevant module when a recorded workflow state requires contextual review'],
      confidence: 1, severity: 'information', audience: ['principal', 'superuser', 'developer'],
      providerId: ID, providerVersion: VERSION, providerRunId: context.runId,
    }));
  }
  return { components: summary, products: created };
}

module.exports = { id: ID, version: VERSION, analyse, governance: {
  inputs: ['certified component intelligence contracts', 'declared component source tables'],
  outputs: ['component.*.records', 'observation'], supportedScopes: ['organisation'],
  minimumEvidence: { observation: 1 },
  confidenceMethod: 'exact current database counts grouped by declared lifecycle status',
  failureMode: 'fail visibly if a certified declaration cannot be queried', knowledgeDependencies: [],
  suppression: ['no operational product for a component with no records', 'no performance or causal conclusion from record counts'],
} };
