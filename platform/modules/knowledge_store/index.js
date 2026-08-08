'use strict';

var db = require('../../shared/services/db');

function _formatRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    status: row.status,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    authorId: row.author_id,
    authorName: row.author_name,
    version: row.version,
    parentDocumentId: row.parent_document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function boot(ctx) {
  ctx.log.info('knowledge_store booting', { module: 'knowledge_store' });
}

function teardown(ctx) {
  ctx.log.info('knowledge_store tearing down', { module: 'knowledge_store' });
}

async function knowledge_store_list(req, ctx) {
  var sql = 'SELECT * FROM knowledge_documents WHERE 1=1';
  var params = [];

  if (req.query.category) {
    sql += ' AND category = ?';
    params.push(req.query.category);
  }
  if (req.query.status) {
    sql += ' AND status = ?';
    params.push(req.query.status);
  }
  if (req.query.tag) {
    sql += ' AND ? IN (SELECT value FROM json_each(tags))';
    params.push(req.query.tag);
  }
  if (req.query.active_only) {
    var now = new Date().toISOString();
    sql += ' AND ((effective_date IS NULL OR effective_date <= ?) AND (expiry_date IS NULL OR expiry_date > ?))';
    params.push(now, now);
  }

  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = parseInt(req.query.offset, 10) || 0;

  sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = db.query(sql, params);
  return { success: true, documents: result.rows.map(_formatRow), limit: limit, offset: offset };
}

async function knowledge_store_create(req, ctx) {
  var body = req.body || {};
  if (!body.title || !body.category || !body.content) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'title, category, content are required' } };
  }

  var validCategories = ['policy', 'procedure', 'precedent', 'guideline'];
  if (validCategories.indexOf(body.category) === -1) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Invalid category. Must be one of: policy, procedure, precedent, guideline' } };
  }

  var validStatuses = ['draft', 'review', 'approved', 'archived'];
  if (body.status && validStatuses.indexOf(body.status) === -1) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Invalid status. Must be one of: draft, review, approved, archived' } };
  }

  var tagsStr = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags || '[]');

  var result = db.query(
    'INSERT INTO knowledge_documents (title, category, content, tags, status, effective_date, expiry_date, author_id, author_name, version, parent_document_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
    [
      body.title, body.category, body.content, tagsStr,
      body.status || 'draft',
      body.effectiveDate || null,
      body.expiryDate || null,
      req.userId || null,
      req.userName || null,
      body.parentDocumentId || null
    ]
  );

  var id = (result && result.lastInsertRowid) ? result.lastInsertRowid : null;
  if (!id) {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'Failed to create document' } };
  }

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('knowledge.created', {
      entityType: 'knowledge',
      entityId: String(id),
      __module: 'knowledge_store',
      category: body.category
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('knowledge.create', req.userId || 'unknown', {
      entityType: 'knowledge',
      entityId: String(id),
      newValue: { title: body.title, category: body.category, status: body.status || 'draft' }
    });
  }

  var created = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
  return { success: true, document: _formatRow(created.rows[0]) };
}

async function knowledge_store_getById(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }
  var result = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Document not found' } };
  }
  return { success: true, document: _formatRow(result.rows[0]) };
}

async function knowledge_store_update(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var existing = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Document not found' } };
  }

  var body = req.body || {};
  var updates = [];
  var params = [];

  if (body.title) {
    updates.push('title = ?');
    params.push(body.title);
  }
  if (body.category) {
    updates.push('category = ?');
    params.push(body.category);
  }
  if (body.content) {
    updates.push('content = ?');
    params.push(body.content);
  }
  if (body.tags !== undefined) {
    updates.push('tags = ?');
    params.push(Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags);
  }
  if (body.status) {
    updates.push('status = ?');
    params.push(body.status);
  }
  if (body.effectiveDate !== undefined) {
    updates.push('effective_date = ?');
    params.push(body.effectiveDate || null);
  }
  if (body.expiryDate !== undefined) {
    updates.push('expiry_date = ?');
    params.push(body.expiryDate || null);
  }

  if (updates.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } };
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.query('UPDATE knowledge_documents SET ' + updates.join(', ') + ' WHERE id = ?', params);

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('knowledge.updated', {
      entityType: 'knowledge',
      entityId: String(id),
      __module: 'knowledge_store'
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('knowledge.update', req.userId || 'unknown', {
      entityType: 'knowledge',
      entityId: String(id),
      newValue: body
    });
  }

  var updated = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
  return { success: true, document: _formatRow(updated.rows[0]) };
}

async function knowledge_store_archive(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var existing = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Document not found' } };
  }

  db.query("UPDATE knowledge_documents SET status = 'archived', updated_at = datetime('now') WHERE id = ?", [id]);

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('knowledge.archived', {
      entityType: 'knowledge',
      entityId: String(id),
      __module: 'knowledge_store'
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('knowledge.archive', req.userId || 'unknown', {
      entityType: 'knowledge',
      entityId: String(id)
    });
  }

  return { success: true, archived: true, id: id };
}

async function knowledge_store_search(req, ctx) {
  var q = req.query.q || '';
  if (!q.trim()) {
    return { success: true, documents: [], query: '' };
  }

  var limit = parseInt(req.query.limit, 10) || 20;
  if (limit > 100) limit = 100;

  var escapedQ = q.replace(/[!?]/g, '\\$&');
  var searchSql = "SELECT * FROM knowledge_documents WHERE " +
    "title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'" +
    " AND status != 'archived' ORDER BY updated_at DESC LIMIT ?";

  var result = db.query(searchSql, ['%' + escapedQ + '%', '%' + escapedQ + '%', limit]);
  return { success: true, documents: result.rows.map(_formatRow), query: q, total: result.rows.length };
}

async function knowledge_store_history(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var original = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [id]);
  if (original.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Document not found' } };
  }

  var doc = _formatRow(original.rows[0]);
  var history = [doc];

  if (doc.parentDocumentId) {
    var cursor = doc.parentDocumentId;
    while (cursor) {
      var prev = db.query('SELECT * FROM knowledge_documents WHERE id = ?', [cursor]);
      if (prev.rows.length === 0) break;
      history.push(_formatRow(prev.rows[0]));
      cursor = prev.rows[0].parent_document_id;
    }
  }

  return { success: true, current: doc, history: history, totalVersions: history.length };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  knowledge_store_list: knowledge_store_list,
  knowledge_store_create: knowledge_store_create,
  knowledge_store_getById: knowledge_store_getById,
  knowledge_store_update: knowledge_store_update,
  knowledge_store_archive: knowledge_store_archive,
  knowledge_store_search: knowledge_store_search,
  knowledge_store_history: knowledge_store_history
};
