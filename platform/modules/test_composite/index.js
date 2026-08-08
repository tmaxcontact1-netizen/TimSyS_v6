'use strict';

var student_registry = require('../student_registry');
var staff_registry = require('../staff_registry');
var room_registry = require('../room_registry');

function boot(ctx) {
  ctx.log.info('test_composite booting', { module: 'test_composite' });
}

function teardown(ctx) {
  ctx.log.info('test_composite tearing down', { module: 'test_composite' });
}

async function test_composite_list(req, ctx) {
  var students = await student_registry.listStudents(req, ctx);
  var staff = await staff_registry.listStaff(req, ctx);
  var rooms = await room_registry.listRooms(req, ctx);

  var studentRows = students.students || [];
  var staffRows = staff.staff || [];
  var roomRows = rooms.rooms || [];

  var activeStudents = studentRows.filter(function (s) {
    return s.enrollment_status === 'active';
  }).length;

  return {
    success: true,
    summary: {
      students_total: students.total !== undefined ? students.total : studentRows.length,
      students_active: activeStudents,
      students_withdrawn: studentRows.length - activeStudents,
      staff_total: staff.total !== undefined ? staff.total : staffRows.length,
      rooms_total: rooms.total !== undefined ? rooms.total : roomRows.length,
      rooms_available: roomRows.filter(function (r) { return r.status === 'available' || !r.status; }).length
    },
    detail: {
      students: studentRows,
      staff: staffRows,
      rooms: roomRows
    }
  };
}

async function test_composite_create(req, ctx) {
  return { success: false, statusCode: 405, error: { code: 'METHOD_NOT_ALLOWED', message: 'Composite module does not support direct creation' } };
}

async function test_composite_read(req, ctx) {
  var students = await student_registry.listStudents({ query: { limit: 500, page: 1 }, params: {}, body: {} }, ctx);
  var staff = await staff_registry.listStaff({ query: { limit: 500, page: 1 }, params: {}, body: {} }, ctx);
  var rooms = await room_registry.listRooms({ query: { limit: 500, page: 1 }, params: {}, body: {} }, ctx);

  var studentRows = students.students || [];
  var staffRows = staff.staff || [];
  var roomRows = rooms.rooms || [];

  var byGradeLevel = {};
  studentRows.forEach(function (s) {
    var gl = s.current_grade_level || 'unknown';
    byGradeLevel[gl] = (byGradeLevel[gl] || 0) + 1;
  });

  var byDepartment = {};
  staffRows.forEach(function (s) {
    var dept = s.department || 'unassigned';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  });

  var byRoomType = {};
  roomRows.forEach(function (r) {
    var rt = r.room_type || 'unknown';
    byRoomType[rt] = (byRoomType[rt] || 0) + 1;
  });

  return {
    success: true,
    dashboard: {
      totals: {
        students: studentRows.length,
        staff: staffRows.length,
        rooms: roomRows.length
      },
      breakdown: {
        students_by_grade: byGradeLevel,
        staff_by_department: byDepartment,
        rooms_by_type: byRoomType
      }
    }
  };
}

async function test_composite_update(req, ctx) {
  return { success: false, statusCode: 405, error: { code: 'METHOD_NOT_ALLOWED', message: 'Composite module does not support direct updates' } };
}

async function test_composite_delete(req, ctx) {
  return { success: false, statusCode: 405, error: { code: 'METHOD_NOT_ALLOWED', message: 'Composite module does not support direct deletion' } };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  test_composite_list: test_composite_list,
  test_composite_create: test_composite_create,
  test_composite_read: test_composite_read,
  test_composite_update: test_composite_update,
  test_composite_delete: test_composite_delete
};
