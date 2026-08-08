'use strict';

var db = require('../../shared/services/db');

function _formatRow(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    relationshipType: row.relationship_type,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function boot(ctx) {
  ctx.log.info('relationship_registry booting', { module: 'relationship_registry' });
}

function teardown(ctx) {
  ctx.log.info('relationship_registry tearing down', { module: 'relationship_registry' });
}

async function relationship_registry_list(req, ctx) {
  var sql = 'SELECT * FROM relationships WHERE 1=1';
  var params = [];

  if (req.query.type) {
    sql += ' AND relationship_type = ?';
    params.push(req.query.type);
  }
  if (req.query.sourceType) {
    sql += ' AND source_type = ?';
    params.push(req.query.sourceType);
  }
  if (req.query.sourceId) {
    sql += ' AND source_id = ?';
    params.push(req.query.sourceId);
  }
  if (req.query.targetType) {
    sql += ' AND target_type = ?';
    params.push(req.query.targetType);
  }
  if (req.query.targetId) {
    sql += ' AND target_id = ?';
    params.push(req.query.targetId);
  }

  var activeParam = req.query.active;
  if (activeParam !== undefined) {
    sql += ' AND active = ?';
    params.push(activeParam === 'true' || activeParam === '1' ? 1 : 0);
  }

  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = parseInt(req.query.offset, 10) || 0;

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = db.query(sql, params);
  return { success: true, relationships: result.rows.map(_formatRow), limit: limit, offset: offset };
}

async function relationship_registry_create(req, ctx) {
  var body = req.body || {};
  if (!body.sourceType || !body.sourceId || !body.targetType || !body.targetId || !body.relationshipType) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'sourceType, sourceId, targetType, targetId, relationshipType are required' } };
  }

  var metadataStr = typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata || {});
  var activeVal = body.active === false ? 0 : 1;

  var result = db.query(
    'INSERT INTO relationships (source_type, source_id, target_type, target_id, relationship_type, metadata, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [body.sourceType, String(body.sourceId), body.targetType, String(body.targetId), body.relationshipType, metadataStr, activeVal]
  );

  var id = (result && result.lastInsertRowid) ? result.lastInsertRowid : null;
  if (!id) {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'Failed to create relationship' } };
  }

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('relationship.created', {
      entityType: 'relationship',
      entityId: String(id),
      __module: 'relationship_registry',
      sourceType: body.sourceType,
      sourceId: String(body.sourceId),
      targetType: body.targetType,
      targetId: String(body.targetId),
      relationshipType: body.relationshipType
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('relationship.create', req.userId || 'unknown', {
      entityType: 'relationship',
      entityId: String(id),
      newValue: body
    });
  }

  var created = db.query('SELECT * FROM relationships WHERE id = ?', [id]);
  return { success: true, relationship: _formatRow(created.rows[0]) };
}

async function relationship_registry_getById(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }
  var result = db.query('SELECT * FROM relationships WHERE id = ?', [id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Relationship not found' } };
  }
  return { success: true, relationship: _formatRow(result.rows[0]) };
}

async function relationship_registry_update(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var body = req.body || {};
  var updates = [];
  var params = [];

  if (body.relationshipType) {
    updates.push('relationship_type = ?');
    params.push(body.relationshipType);
  }
  if (body.metadata !== undefined) {
    updates.push('metadata = ?');
    params.push(typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata));
  }
  if (body.active !== undefined) {
    updates.push('active = ?');
    params.push(body.active === true || body.active === 1 ? 1 : 0);
  }

  if (updates.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } };
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.query('UPDATE relationships SET ' + updates.join(', ') + ' WHERE id = ?', params);

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('relationship.updated', {
      entityType: 'relationship',
      entityId: String(id),
      __module: 'relationship_registry'
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('relationship.update', req.userId || 'unknown', {
      entityType: 'relationship',
      entityId: String(id),
      newValue: body
    });
  }

  var updated = db.query('SELECT * FROM relationships WHERE id = ?', [id]);
  return { success: true, relationship: _formatRow(updated.rows[0]) };
}

async function relationship_registry_delete(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var existing = db.query('SELECT * FROM relationships WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Relationship not found' } };
  }

  db.query("UPDATE relationships SET active = 0, updated_at = datetime('now') WHERE id = ?", [id]);

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('relationship.deactivated', {
      entityType: 'relationship',
      entityId: String(id),
      __module: 'relationship_registry'
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('relationship.deactivate', req.userId || 'unknown', {
      entityType: 'relationship',
      entityId: String(id)
    });
  }

  return { success: true, deactivated: true, id: id };
}

async function relationship_registry_getByEntity(req, ctx) {
  var entityType = req.params.type;
  var entityId = req.params.id;
  var limit = parseInt(req.query.limit, 10) || 50;

  var result = db.query(
    'SELECT * FROM relationships WHERE ((source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)) AND active = 1 ORDER BY id DESC LIMIT ?',
    [entityType, entityId, entityType, entityId, limit]
  );

  return { success: true, relationships: result.rows.map(_formatRow), entityType: entityType, entityId: entityId };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  relationship_registry_list: relationship_registry_list,
  relationship_registry_create: relationship_registry_create,
  relationship_registry_getById: relationship_registry_getById,
  relationship_registry_update: relationship_registry_update,
  relationship_registry_delete: relationship_registry_delete,
  relationship_registry_getByEntity: relationship_registry_getByEntity
};
