// Path: /home/tmax/TimSyS_v6/platform/modules/room_registry/index.js
// Total lines: ~280

'use strict';

function boot(ctx) {
  ctx.log.info('room_registry booting', { module: 'room_registry' });
}

function teardown(ctx) {
  ctx.log.info('room_registry tearing down', { module: 'room_registry' });
}

async function listRooms(req, ctx) {
  var page = parseInt(req.query.page, 10) || 1;
  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = (page - 1) * limit;

  var conditions = [];
  var params = [];

  if (req.query.room_number) {
    conditions.push('room_number LIKE ?');
    params.push('%' + req.query.room_number + '%');
  }
  if (req.query.room_type) {
    conditions.push('room_type = ?');
    params.push(req.query.room_type);
  }
  if (req.query.building_id) {
    conditions.push('building_id = ?');
    params.push(req.query.building_id);
  }
  if (req.query.status) {
    conditions.push('status = ?');
    params.push(req.query.status);
  }
  if (req.query.min_capacity) {
    conditions.push('capacity >= ?');
    params.push(req.query.min_capacity);
  }

  var where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  var sql = 'SELECT * FROM rooms' + where + ' ORDER BY room_number ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = ctx.db.query(sql, params);
  var countSql = 'SELECT COUNT(*) as total FROM rooms' + where;
  var countResult = ctx.db.query(countSql, conditions.length > 0 ? params.slice(0, conditions.length) : []);

  return {
    success: true,
    rooms: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    page: page,
    limit: limit
  };
}

async function createRoom(req, ctx) {
  var b = req.body;
  if (!b.room_number || !b.capacity) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'room_number and capacity are required' }
    };
  }

  if (b.capacity < 1) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'capacity must be greater than 0' }
    };
  }

  var existing = ctx.db.query('SELECT id FROM rooms WHERE room_number = ?', [b.room_number]);
  if (existing.rows.length > 0) {
    return {
      success: false,
      statusCode: 409,
      error: { code: 'DUPLICATE', message: 'Room with room_number "' + b.room_number + '" already exists' }
    };
  }

  var result = ctx.db.query(
    `INSERT INTO rooms (
      room_number, building_id, capacity, room_type, features,
      accessibility_flags, equipment_list, status, notes, custom_fields
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.room_number, b.building_id || null, b.capacity, b.room_type || 'general',
      JSON.stringify(b.features || {}), JSON.stringify(b.accessibility_flags || {}), JSON.stringify(b.equipment_list || []),
      b.status || 'available', b.notes || null, b.custom_fields || '{}'
    ]
  );

  var insertedId = result.lastInsertRowid;
  var room = ctx.db.query('SELECT * FROM rooms WHERE id = ?', [insertedId]);

  ctx.events.publish('room.created', { roomId: insertedId, roomNumber: b.room_number, entityType: 'room', entityId: insertedId, __module: 'room_registry' });

  if (ctx.intelligence) {
    ctx.intelligence.storeMetadata('room', insertedId.toString(), room.rows[0]);
  }

  if (ctx.audit) {
    ctx.audit.action('room.create', req.user.id, {
      entityType: 'room',
      entityId: insertedId,
      newValue: room.rows[0]
    });
  }

  return { success: true, room: room.rows[0] };
}

async function readRoom(req, ctx) {
  var id = req.params.id;
  var result = ctx.db.query('SELECT * FROM rooms WHERE id = ? OR room_number = ?', [id, id]);

  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Room not found' } };
  }

  return { success: true, room: result.rows[0] };
}

async function updateRoom(req, ctx) {
  var id = req.params.id;
  var b = req.body;

  var existing = ctx.db.query('SELECT * FROM rooms WHERE id = ? OR room_number = ?', [id, id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Room not found' } };
  }

  var allowedFields = [
    'building_id', 'capacity', 'room_type', 'features',
    'accessibility_flags', 'equipment_list', 'status', 'notes', 'custom_fields'
  ];

  var updates = [];
  var params = [];

  for (var i = 0; i < allowedFields.length; i++) {
    var field = allowedFields[i];
    if (b[field] !== undefined) {
      if (field === 'capacity' && b[field] < 1) {
        return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'capacity must be greater than 0' } };
      }
      if (field === 'features' || field === 'accessibility_flags') {
        params.push(JSON.stringify(b[field]));
      } else if (field === 'equipment_list') {
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

  ctx.db.query('UPDATE rooms SET ' + updates.join(', ') + ' WHERE id = ?', params);

  var updated = ctx.db.query('SELECT * FROM rooms WHERE id = ?', [existing.rows[0].id]);

  ctx.events.publish('room.updated', { roomId: existing.rows[0].id, entityType: 'room', entityId: existing.rows[0].id, __module: 'room_registry' });

  if (ctx.intelligence) {
    ctx.intelligence.storeMetadata('room', existing.rows[0].id.toString(), updated.rows[0]);
  }

  if (ctx.audit) {
    ctx.audit.action('room.update', req.user.id, {
      entityType: 'room',
      entityId: existing.rows[0].id,
      oldValue: existing.rows[0],
      newValue: updated.rows[0]
    });
  }

  return { success: true, room: updated.rows[0] };
}

async function deleteRoom(req, ctx) {
  var id = req.params.id;
  var existing = ctx.db.query('SELECT * FROM rooms WHERE id = ? OR room_number = ?', [id, id]);

  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Room not found' } };
  }

  ctx.db.query("UPDATE rooms SET status = 'blocked', updated_at = datetime('now') WHERE id = ?", [existing.rows[0].id]);

  ctx.events.publish('room.blocked', { roomId: existing.rows[0].id, entityType: 'room', entityId: existing.rows[0].id, __module: 'room_registry' });

  if (ctx.audit) {
    ctx.audit.action('room.block', req.user.id, {
      entityType: 'room',
      entityId: existing.rows[0].id,
      oldValue: existing.rows[0]
    });
  }

  return { success: true, message: 'Room blocked (soft delete)' };
}

async function listBookings(req, ctx) {
  var roomId = req.params.id;
  var room = ctx.db.query('SELECT id FROM rooms WHERE id = ? OR room_number = ?', [roomId, roomId]);

  if (room.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Room not found' } };
  }

  var result = ctx.db.query('SELECT * FROM room_bookings WHERE room_id = ? ORDER BY start_time ASC', [room.rows[0].id]);

  return { success: true, bookings: result.rows, total: result.rows.length };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  listRooms: listRooms,
  createRoom: createRoom,
  readRoom: readRoom,
  updateRoom: updateRoom,
  deleteRoom: deleteRoom,
  listBookings: listBookings
};