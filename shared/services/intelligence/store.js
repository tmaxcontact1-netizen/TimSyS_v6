'use strict';

const db = require('../db');
const crypto = require('crypto');

/**
 * Persistence layer for intelligence service.
 */
class Store {
  async insertMetadata(entityType, entityId, metadata, dataSnapshot) {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.query(
      'INSERT INTO intelligence_metadata (id, entity_type, entity_id, tags, classifications, confidence, data_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, entityType, entityId,
        JSON.stringify(metadata.tags || []),
        JSON.stringify(metadata.classifications || []),
        metadata.confidence || 0,
        JSON.stringify(dataSnapshot),
        now, now
      ]
    );
    return id;
  }

  async upsertMetadata(entityType, entityId, metadata, dataSnapshot) {
    const existing = db.query(
      'SELECT id FROM intelligence_metadata WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    if (existing.rows.length > 0) {
      const now = Date.now();
      db.query(
        'UPDATE intelligence_metadata SET tags = ?, classifications = ?, confidence = ?, data_snapshot = ?, updated_at = ? WHERE entity_type = ? AND entity_id = ?',
        [
          JSON.stringify(metadata.tags || []),
          JSON.stringify(metadata.classifications || []),
          metadata.confidence || 0,
          JSON.stringify(dataSnapshot),
          now, entityType, entityId
        ]
      );
      return existing.rows[0].id;
    } else {
      return this.insertMetadata(entityType, entityId, metadata, dataSnapshot);
    }
  }

  async getMetadata(entityType, entityId) {
    const result = db.query(
      'SELECT * FROM intelligence_metadata WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      classifications: typeof row.classifications === 'string' ? JSON.parse(row.classifications) : row.classifications,
      confidence: row.confidence,
      dataSnapshot: typeof row.data_snapshot === 'string' ? JSON.parse(row.data_snapshot) : row.data_snapshot,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async insertInsight(scopeType, scopeId, insightType, summary, metricsData, trendsData, alerts, expiresAt) {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.query(
      'INSERT INTO intelligence_insights (id, scope_type, scope_id, insight_type, summary, metrics_data, trends_data, alerts, generated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, scopeType, scopeId, insightType, summary,
        JSON.stringify(metricsData || {}),
        JSON.stringify(trendsData || []),
        JSON.stringify(alerts || []),
        now, expiresAt || null
      ]
    );
    return id;
  }

  async getInsights(scopeType, scopeId, insightType) {
    let sql = 'SELECT * FROM intelligence_insights WHERE scope_type = ? AND scope_id = ?';
    const params = [scopeType, scopeId];
    if (insightType) {
      sql += ' AND insight_type = ?';
      params.push(insightType);
    }
    const result = db.query(sql, params);
    return result.rows.map(row => ({
      id: row.id,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      insightType: row.insight_type,
      summary: row.summary,
      metricsData: typeof row.metrics_data === 'string' ? JSON.parse(row.metrics_data) : row.metrics_data,
      trendsData: typeof row.trends_data === 'string' ? JSON.parse(row.trends_data) : row.trends_data,
      alerts: typeof row.alerts === 'string' ? JSON.parse(row.alerts) : row.alerts,
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
    }));
  }

  async deleteOldInsights() {
    const now = Date.now();
    db.query('DELETE FROM intelligence_insights WHERE expires_at IS NOT NULL AND expires_at <= ?', [now]);
  }

  async insertRule(name, description, conditions, actions, priority) {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.query(
      'INSERT INTO intelligence_rules (id, name, description, conditions, actions, priority, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, description || '', JSON.stringify(conditions), JSON.stringify(actions), priority || 0, 1, now, now]
    );
    return id;
  }

  async getRules(enabledOnly) {
    let sql = 'SELECT * FROM intelligence_rules';
    if (enabledOnly) {
      sql += ' WHERE enabled = 1';
    }
    sql += ' ORDER BY priority DESC';
    const result = db.query(sql);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
      priority: row.priority,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggeredAt: row.last_triggered_at,
    }));
  }

  async getRule(ruleId) {
    const result = db.query('SELECT * FROM intelligence_rules WHERE id = ?', [ruleId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
      priority: row.priority,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastTriggeredAt: row.last_triggered_at,
    };
  }

  async deleteRule(ruleId) {
    db.query('DELETE FROM intelligence_rules WHERE id = ?', [ruleId]);
  }

  async updateRuleLastTriggered(ruleId) {
    db.query('UPDATE intelligence_rules SET last_triggered_at = ?, updated_at = ? WHERE id = ?', [Date.now(), Date.now(), ruleId]);
  }
}

const store = new Store();
module.exports = store;