// Path: /home/tmax/TimSyS_v6/platform/modules/inventory/index.js
// Total lines: ~310

'use strict';

function boot(ctx) {
  ctx.log.info('inventory booting', { module: 'inventory' });
}

function teardown(ctx) {
  ctx.log.info('inventory tearing down', { module: 'inventory' });
}

async function listItems(req, ctx) {
  var page = parseInt(req.query.page, 10) || 1;
  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = (page - 1) * limit;

  var conditions = [];
  var params = [];

  if (req.query.item_number) {
    conditions.push('item_number LIKE ?');
    params.push('%' + req.query.item_number + '%');
  }
  if (req.query.item_name) {
    conditions.push('item_name LIKE ?');
    params.push('%' + req.query.item_name + '%');
  }
  if (req.query.category) {
    conditions.push('category = ?');
    params.push(req.query.category);
  }
  if (req.query.location) {
    conditions.push('location LIKE ?');
    params.push('%' + req.query.location + '%');
  }
  if (req.query.condition) {
    conditions.push('condition = ?');
    params.push(req.query.condition);
  }
  if (req.query.status) {
    conditions.push('status = ?');
    params.push(req.query.status);
  }
  if (req.query.min_quantity) {
    conditions.push('quantity >= ?');
    params.push(req.query.min_quantity);
  }

  var where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  var sql = 'SELECT * FROM inventory_items' + where + ' ORDER BY item_name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = ctx.db.query(sql, params);
  var countSql = 'SELECT COUNT(*) as total FROM inventory_items' + where;
  var countResult = ctx.db.query(countSql, conditions.length > 0 ? params.slice(0, conditions.length) : []);

  return {
    success: true,
    items: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    page: page,
    limit: limit
  };
}

async function createItem(req, ctx) {
  var b = req.body;
  if (!b.item_name || !b.item_number) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'item_name and item_number are required' }
    };
  }

  var existing = ctx.db.query('SELECT id FROM inventory_items WHERE item_number = ?', [b.item_number]);
  if (existing.rows.length > 0) {
    return {
      success: false,
      statusCode: 409,
      error: { code: 'DUPLICATE', message: 'Item with item_number "' + b.item_number + '" already exists' }
    };
  }

  var result = ctx.db.query(
    `INSERT INTO inventory_items (
      item_name, item_number, category, quantity, unit, location,
      condition, purchase_date, supplier, purchase_price, warranty_expiry,
      serial_number, manufacturer, model_number, maintenance_schedule,
      maintenance_history, assigned_to_staff_id, assigned_to_student_id,
      status, notes, custom_fields
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.item_name, b.item_number, b.category || 'general', b.quantity || 1, b.unit || 'each', b.location || null,
      b.condition || 'good', b.purchase_date || null, b.supplier || null, b.purchase_price || null,
      b.warranty_expiry || null, b.serial_number || null, b.manufacturer || null, b.model_number || null,
      JSON.stringify(b.maintenance_schedule || {}), JSON.stringify(b.maintenance_history || []),
      b.assigned_to_staff_id || null, b.assigned_to_student_id || null,
      b.status || 'available', b.notes || null, b.custom_fields || '{}'
    ]
  );

  var insertedId = result.lastInsertRowid;
  var item = ctx.db.query('SELECT * FROM inventory_items WHERE id = ?', [insertedId]);

  ctx.events.publish('item.created', { itemId: insertedId, itemName: b.item_name, entityType: 'item', entityId: insertedId, __module: 'inventory' });

  if (ctx.intelligence) {
    ctx.intelligence.storeMetadata('item', insertedId.toString(), item.rows[0]);
  }

  if (ctx.audit) {
    ctx.audit.action('item.create', req.user.id, {
      entityType: 'item',
      entityId: insertedId,
      newValue: item.rows[0]
    });
  }

  return { success: true, item: item.rows[0] };
}

async function readItem(req, ctx) {
  var id = req.params.id;
  var result = ctx.db.query('SELECT * FROM inventory_items WHERE id = ? OR item_number = ?', [id, id]);

  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Item not found' } };
  }

  return { success: true, item: result.rows[0] };
}

async function updateItem(req, ctx) {
  var id = req.params.id;
  var b = req.body;

  var existing = ctx.db.query('SELECT * FROM inventory_items WHERE id = ? OR item_number = ?', [id, id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Item not found' } };
  }

  var allowedFields = [
    'item_name', 'category', 'quantity', 'unit', 'location',
    'condition', 'purchase_date', 'supplier', 'purchase_price', 'warranty_expiry',
    'serial_number', 'manufacturer', 'model_number', 'maintenance_schedule',
    'maintenance_history', 'assigned_to_staff_id', 'assigned_to_student_id',
    'status', 'notes', 'custom_fields'
  ];

  var updates = [];
  var params = [];

  for (var i = 0; i < allowedFields.length; i++) {
    var field = allowedFields[i];
    if (b[field] !== undefined) {
      if (field === 'quantity' && b[field] < 0) {
        return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'quantity cannot be negative' } };
      }
      if (field === 'maintenance_schedule') {
        params.push(JSON.stringify(b[field]));
      } else if (field === 'maintenance_history') {
        params.push(JSON.stringify(b[field] || []));
      } else {
        params.push(b[field]);
      }
      updates.push(field + ' = ?');
    }
  }

  if (updates.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } };
  }

  updates.push("updated_at = datetime('now')");
  params.push(existing.rows[0].id);

  ctx.db.query('UPDATE inventory_items SET ' + updates.join(', ') + ' WHERE id = ?', params);

  var updated = ctx.db.query('SELECT * FROM inventory_items WHERE id = ?', [existing.rows[0].id]);

  ctx.events.publish('item.updated', { itemId: existing.rows[0].id, entityType: 'item', entityId: existing.rows[0].id, __module: 'inventory' });

  if (ctx.intelligence) {
    ctx.intelligence.storeMetadata('item', existing.rows[0].id.toString(), updated.rows[0]);
  }

  if (ctx.audit) {
    ctx.audit.action('item.update', req.user.id, {
      entityType: 'item',
      entityId: existing.rows[0].id,
      oldValue: existing.rows[0],
      newValue: updated.rows[0]
    });
  }

  return { success: true, item: updated.rows[0] };
}

async function deleteItem(req, ctx) {
  var id = req.params.id;
  var existing = ctx.db.query('SELECT * FROM inventory_items WHERE id = ? OR item_number = ?', [id, id]);

  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Item not found' } };
  }

  ctx.db.query("UPDATE inventory_items SET status = 'retired', updated_at = datetime('now') WHERE id = ?", [existing.rows[0].id]);

  ctx.events.publish('item.retired', { itemId: existing.rows[0].id, entityType: 'item', entityId: existing.rows[0].id, __module: 'inventory' });

  if (ctx.audit) {
    ctx.audit.action('item.retire', req.user.id, {
      entityType: 'item',
      entityId: existing.rows[0].id,
      oldValue: existing.rows[0]
    });
  }

  return { success: true, message: 'Item retired (soft delete)' };
}

async function listCheckouts(req, ctx) {
  var itemId = req.params.id;
  var item = ctx.db.query('SELECT id FROM inventory_items WHERE id = ? OR item_number = ?', [itemId, itemId]);

  if (item.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Item not found' } };
  }

  var result = ctx.db.query('SELECT * FROM inventory_checkouts WHERE item_id = ? ORDER BY checkout_date DESC', [item.rows[0].id]);

  return { success: true, checkouts: result.rows, total: result.rows.length };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  listItems: listItems,
  createItem: createItem,
  readItem: readItem,
  updateItem: updateItem,
  deleteItem: deleteItem,
  listCheckouts: listCheckouts
};