'use strict';
var helper = require('../helpers/test-server');

describe('world model component coverage', function() {
  var server;
  afterEach(async function() { if (server) await server.cleanup(); });
  test('backfills composed and operational entities with their relationships', async function() {
    server = await helper.createTestServer('world_model_coverage');
    var db = require('../../shared/services/db');
    var student = db.query("INSERT INTO students(student_id,first_name,last_name,date_of_birth,sex,enrollment_date) VALUES ('WM-S','World','Student','2012-01-01','Female','2026-01-01')").lastInsertRowid;
    var staff = db.query("INSERT INTO staff(staff_id,first_name,last_name,hire_date) VALUES ('WM-T','World','Teacher','2025-01-01')").lastInsertRowid;
    var room = db.query("INSERT INTO rooms(room_number,capacity) VALUES ('WM-R',20)").lastInsertRowid;
    var item = db.query("INSERT INTO inventory_items(item_name,item_number,quantity,assigned_to_staff_id) VALUES ('Laptop','WM-I',1,?)", [staff]).lastInsertRowid;
    db.query("INSERT INTO student_profile_extended(student_id,created_at,updated_at) VALUES (?,?,?)", [student,new Date().toISOString(),new Date().toISOString()]);
    db.query("INSERT INTO staff_profile_extended(staff_id,created_at,updated_at) VALUES (?,?,?)", [staff,new Date().toISOString(),new Date().toISOString()]);
    var booking = db.query("INSERT INTO room_bookings(room_id,booker_staff_id,title,start_time,end_time) VALUES (?,?, 'Planning','2026-09-01T08:00:00Z','2026-09-01T09:00:00Z')", [room,staff]).lastInsertRowid;
    var checkout = db.query("INSERT INTO inventory_checkouts(item_id,checkout_student_id,checkout_date) VALUES (?,?, '2026-09-01')", [item,student]).lastInsertRowid;
    var result = require('../../shared/services/world_model/backfill').run();
    expect(result.errors).toEqual([]);
    ['student','staff','room','inventory_item','student_profile','staff_profile','room_booking','inventory_checkout'].forEach(function(type) {
      expect(db.scalar('SELECT COUNT(*) FROM world_entities WHERE entity_type=?', [type])).toBeGreaterThan(0);
    });
    expect(db.scalar("SELECT COUNT(*) FROM world_relationships WHERE subject_type='room_booking' AND subject_id=? AND relationship_type='booking_for' AND object_id=? AND valid_to IS NULL", [String(booking),String(room)])).toBe(1);
    expect(db.scalar("SELECT COUNT(*) FROM world_relationships WHERE subject_type='inventory_checkout' AND subject_id=? AND relationship_type='checked_out_by' AND object_type='student' AND object_id=? AND valid_to IS NULL", [String(checkout),String(student)])).toBe(1);
  });
});
