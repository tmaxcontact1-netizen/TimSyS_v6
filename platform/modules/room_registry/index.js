'use strict';

var statusActions = require('../../shared/services/statusActions');
var csvParser = require('../../shared/services/csv_parser');

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

  if (req.query.room_number) { conditions.push('room_number LIKE ?'); params.push('%' + req.query.room_number + '%'); }
  if (req.query.room_type) { conditions.push('room_type = ?'); params.push(req.query.room_type); }
  if (req.query.building) { conditions.push('building = ?'); params.push(req.query.building); }
  if (req.query.status) { conditions.push('status = ?'); params.push(req.query.status); }
  if (req.query.min_capacity) { conditions.push('capacity >= ?'); params.push(req.query.min_capacity); }

  var where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  var sql = 'SELECT * FROM rooms' + where + ' ORDER BY room_number ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = ctx.db.query(sql, params);
  var countSql = 'SELECT COUNT(*) as total FROM rooms' + where;
  var countResult = ctx.db.query(countSql, conditions.length > 0 ? params.slice(0, conditions.length) : []);

  return { success: true, rooms: result.rows, total: parseInt(countResult.rows[0].total, 10), page: page, limit: limit };
}

async function createRoom(req, ctx) {
  var b = req.body;
  if (!b.room_number || !b.capacity) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'room_number and capacity are required' } };
  }
  if (b.capacity < 1) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'capacity must be greater than 0' } };
  }

  var existing = ctx.db.query('SELECT id FROM rooms WHERE room_number = ?', [b.room_number]);
  if (existing.rows.length > 0) {
    return { success: false, statusCode: 409, error: { code: 'DUPLICATE', message: 'Room with room_number "' + b.room_number + '" already exists' } };
  }

  var result = ctx.db.query(
    "INSERT INTO rooms (room_number, building, capacity, room_type, features, accessibility_flags, equipment_list, status, notes, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [b.room_number, b.building || null, b.capacity, b.room_type || 'general', JSON.stringify(b.features || {}), JSON.stringify(b.accessibility_flags || {}), JSON.stringify(b.equipment_list || []), b.status || 'available', b.notes || null, b.custom_fields || '{}']
  );

  var insertedId = result.lastInsertRowid;
  var room = ctx.db.query('SELECT * FROM rooms WHERE id = ?', [insertedId]);

  ctx.events.publish('room.created', { roomId: insertedId, roomNumber: b.room_number, entityType: 'room', entityId: insertedId, __module: 'room_registry' });
  if (ctx.intelligence) { try { ctx.intelligence.storeMetadata('room', insertedId.toString(), room.rows[0]); } catch (e) {} }
  if (ctx.audit) { ctx.audit.action('room.create', req.user.id, { entityType: 'room', entityId: insertedId, newValue: room.rows[0] }); }

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

  var allowedFields = ['building', 'capacity', 'room_type', 'features', 'accessibility_flags', 'equipment_list', 'status', 'notes', 'custom_fields'];

  var updates = [];
  var params = [];

  for (var i = 0; i < allowedFields.length; i++) {
    var field = allowedFields[i];
    if (b[field] !== undefined) {
      if (field === 'capacity' && b[field] < 1) {
        return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'capacity must be greater than 0' } };
      }
      if (['features', 'accessibility_flags'].indexOf(field) !== -1) {
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
  if (ctx.intelligence) { try { ctx.intelligence.storeMetadata('room', existing.rows[0].id.toString(), updated.rows[0]); } catch (e) {} }
  if (ctx.audit) { ctx.audit.action('room.update', req.user.id, { entityType: 'room', entityId: existing.rows[0].id, oldValue: existing.rows[0], newValue: updated.rows[0] }); }

  return { success: true, room: updated.rows[0] };
}

var statusConfig = {
  "table": "rooms",
  "altIdField": "room_number",
  "statusField": "status",
  "withdrawnValue": "blocked",
  "activeValue": "available",
  "entityType": "Room",
  "moduleName": "room_registry"
};

async function withdraw(req, ctx) {
  return statusActions.withdraw(statusConfig, req, ctx);
}

async function reinstate(req, ctx) {
  return statusActions.reinstate(statusConfig, req, ctx);
}

async function permanentDelete(req, ctx) {
  return statusActions.permanentDelete(statusConfig, req, ctx);
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

var roomColumnMap = {
  'roomnumber': 'room_number', 'room': 'room_number',
  'buildingid': 'building', 'building': 'building',
  'capacity': 'capacity', 'maxcapacity': 'capacity', 'seats': 'capacity',
  'roomtype': 'room_type', 'type': 'room_type',
  'status': 'status', 'notes': 'notes'
};

async function importRooms(req, ctx) {
  var body = req.body || {};
  if (!body.csv) return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'CSV data required' } };
  
  var parsed = csvParser.parse(Buffer.from(body.csv));
  var mapped = csvParser.mapRows(parsed.rows, roomColumnMap);
  var inserted = 0, skipped = 0, errors = [];
  
  for (var i = 0; i < mapped.length; i++) {
    var m = mapped[i].mapped;
    if (!m.room_number || !m.capacity) {
      errors.push({ row: i + 2, reason: 'Missing required field (room_number, capacity)' });
      skipped++;
      continue;
    }
    var cap = parseInt(m.capacity, 10);
    if (isNaN(cap) || cap <= 0) {
      errors.push({ row: i + 2, reason: 'Invalid capacity: ' + m.capacity });
      skipped++;
      continue;
    }
    var existing = ctx.db.query('SELECT id FROM rooms WHERE room_number = ?', [m.room_number]);
    if (existing.rows.length > 0) {
      errors.push({ row: i + 2, reason: 'Duplicate room_number: ' + m.room_number });
      skipped++;
      continue;
    }
    try {
      ctx.db.query(
        'INSERT INTO rooms (room_number, building, capacity, room_type, features, accessibility_flags, equipment_list, status, notes, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [m.room_number, m.building || null, cap, m.room_type || 'general', '{}', '{}', '[]', m.status || 'available', m.notes || null, '{}']
      );
      inserted++;
    } catch (e) {
      errors.push({ row: i + 2, reason: e.message });
      skipped++;
    }
  }
  return { success: true, inserted: inserted, skipped: skipped, errors: errors };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  listRooms: listRooms,
  createRoom: createRoom,
  readRoom: readRoom,
  updateRoom: updateRoom,
  withdraw: withdraw,
  reinstate: reinstate,
  permanentDelete: permanentDelete,
  listBookings: listBookings,
  importRooms: importRooms
};
