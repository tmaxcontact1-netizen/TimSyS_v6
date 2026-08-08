'use strict';

var db = require('../../shared/services/db');

function _formatRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    roleTarget: row.role_target,
    title: row.title,
    message: row.message,
    category: row.category,
    severity: row.severity,
    sourceType: row.source_type,
    sourceId: row.source_id,
    read: row.read === 1,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    createdAt: row.created_at,
    readAt: row.read_at
  };
}

function boot(ctx) {
  ctx.log.info('notification booting', { module: 'notification' });

  // Subscribe to auto_rules.analyzed
  if (ctx.events && ctx.events.subscribe) {
    ctx.events.subscribe('auto_rules.analyzed', function(evt) {
      _createNotification({
        roleTarget: 'admin',
        title: 'Auto-Rule Analysis Complete',
        message: evt.detected + ' patterns detected, ' + evt.inserted + ' suggestions generated',
        category: 'auto_rules',
        severity: 'info',
        sourceType: 'auto_rule',
        sourceId: 'batch',
        metadata: evt
      });
    });
  }

  // Subscribe to auto_rules.status_changed
  if (ctx.events && ctx.events.subscribe) {
    ctx.events.subscribe('auto_rules.status_changed', function(evt) {
      _createNotification({
        roleTarget: 'admin',
        title: 'Rule Status Changed',
        message: 'Rule #' + evt.entityId + ' status changed to ' + evt.newStatus,
        category: 'auto_rules',
        severity: evt.newStatus === 'active' ? 'warning' : 'info',
        sourceType: 'auto_rule',
        sourceId: evt.entityId,
        metadata: evt
      });
    });
  }

  // Subscribe to snapshot.completed
  if (ctx.events && ctx.events.subscribe) {
    ctx.events.subscribe('snapshot.completed', function(evt) {
      _createNotification({
        roleTarget: 'admin',
        title: 'Snapshot Completed',
        message: evt.metricCount + ' metrics captured',
        category: 'snapshot',
        severity: 'info',
        sourceType: 'snapshot',
        sourceId: evt.entityId,
        metadata: evt
      });
    });
  }

  // Subscribe to knowledge.archived
  if (ctx.events && ctx.events.subscribe) {
    ctx.events.subscribe('knowledge.archived', function(evt) {
      _createNotification({
        roleTarget: 'admin',
        title: 'Document Archived',
        message: 'Knowledge document #' + evt.entityId + ' has been archived',
        category: 'knowledge',
        severity: 'warning',
        sourceType: 'knowledge',
        sourceId: evt.entityId,
        metadata: evt
      });
    });
  }
}

function teardown(ctx) {
  ctx.log.info('notification tearing down', { module: 'notification' });

  // Unsubscribe handlers would go here if stored
}

function _createNotification(data) {
  db.query(
    'INSERT INTO notifications (user_id, role_target, title, message, category, severity, source_type, source_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      data.userId || null,
      data.roleTarget || null,
      data.title,
      data.message,
      data.category || 'system',
      data.severity || 'info',
      data.sourceType || null,
      data.sourceId || null,
      JSON.stringify(data.metadata || {})
    ]
  );
}

async function notification_list(req, ctx) {
  var sql = 'SELECT * FROM notifications WHERE 1=1';
  var params = [];

  var currentUserId = req.userId || null;

  // Filter by user OR role target
  sql += ' AND (role_target IS NULL OR role_target = \'admin\')';

  if (req.query.read !== undefined) {
    var readVal = req.query.read === 'true' || req.query.read === '1' ? 1 : 0;
    sql += ' AND read = ?';
    params.push(readVal);
  }
  if (req.query.category) {
    sql += ' AND category = ?';
    params.push(req.query.category);
  }
  if (req.query.severity) {
    sql += ' AND severity = ?';
    params.push(req.query.severity);
  }

  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = parseInt(req.query.offset, 10) || 0;

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = db.query(sql, params);
  var totalNotifs = db.query('SELECT COUNT(*) as v FROM notifications WHERE (role_target IS NULL OR role_target = \'admin\')').rows[0].v;

  return { success: true, notifications: result.rows.map(_formatRow), total: totalNotifs, limit: limit, offset: offset };
}

async function notification_unread(req, ctx) {
  var unreadCount = db.query("SELECT COUNT(*) as v FROM notifications WHERE read = 0 AND (role_target IS NULL OR role_target = 'admin')").rows[0].v;
  var result = db.query("SELECT * FROM notifications WHERE read = 0 AND (role_target IS NULL OR role_target = 'admin') ORDER BY id DESC LIMIT 20");

  return { success: true, notifications: result.rows.map(_formatRow), unreadCount: unreadCount };
}

async function notification_create(req, ctx) {
  var body = req.body || {};
  if (!body.title || !body.message) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'title and message are required' } };
  }

  var validSeverities = ['info', 'warning', 'critical'];
  if (body.severity && validSeverities.indexOf(body.severity) === -1) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Invalid severity. Must be: info, warning, critical' } };
  }

  var validCategories = ['system', 'auto_rules', 'snapshot', 'knowledge', 'custom'];
  if (body.category && validCategories.indexOf(body.category) === -1) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Invalid category' } };
  }

  _createNotification({
    userId: body.userId || null,
    roleTarget: body.roleTarget || 'admin',
    title: body.title,
    message: body.message,
    category: body.category || 'system',
    severity: body.severity || 'info',
    sourceType: body.sourceType || null,
    sourceId: body.sourceId || null,
    metadata: body.metadata || {}
  });

  var id = db.query('SELECT last_insert_rowid() as v').rows[0].v;
  var created = db.query('SELECT * FROM notifications WHERE id = ?', [id]);

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('notification.created', {
      entityType: 'notification',
      entityId: String(id),
      __module: 'notification',
      category: body.category
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('notification.create', req.userId || 'unknown', {
      entityType: 'notification',
      entityId: String(id),
      newValue: { title: body.title, message: body.message, roleTarget: body.roleTarget || 'admin' }
    });
  }

  return { success: true, notification: _formatRow(created.rows[0]) };
}

async function notification_markRead(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var existing = db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Notification not found' } };
  }

  db.query("UPDATE notifications SET read = 1, read_at = datetime('now') WHERE id = ?", [id]);

  var updated = db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  return { success: true, notification: _formatRow(updated.rows[0]) };
}

async function notification_markUnread(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var existing = db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Notification not found' } };
  }

  db.query("UPDATE notifications SET read = 0, read_at = NULL WHERE id = ?", [id]);

  var updated = db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  return { success: true, notification: _formatRow(updated.rows[0]) };
}

async function notification_delete(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var existing = db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Notification not found' } };
  }

  db.query('DELETE FROM notifications WHERE id = ?', [id]);

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('notification.delete', req.userId || 'unknown', {
      entityType: 'notification',
      entityId: String(id)
    });
  }

  return { success: true, deleted: true, id: id };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  notification_list: notification_list,
  notification_unread: notification_unread,
  notification_create: notification_create,
  notification_markRead: notification_markRead,
  notification_markUnread: notification_markUnread,
  notification_delete: notification_delete
};
