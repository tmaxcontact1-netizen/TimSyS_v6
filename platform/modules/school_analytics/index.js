'use strict';
const fs = require('fs');
const path = require('path');

function boot(ctx) {
  ctx.log.info('school_analytics booting', { module: 'school_analytics' });
}

function teardown(ctx) {
  ctx.log.info('school_analytics tearing down', { module: 'school_analytics' });
}

async function getAllMetrics(req, ctx) {
  const result = {};

  // STUDENT METRICS - Direct query, no pagination
  const studentsRes = ctx.db.query('SELECT * FROM students');
  result.students = {
    total: studentsRes.rows.length,
    active: studentsRes.rows.filter(s => s.enrollment_status === 'active').length,
    withdrawn: studentsRes.rows.filter(s => s.enrollment_status === 'withdrawn').length
  };
  result.students.activePct = result.students.total > 0 ? Math.round((result.students.active / result.students.total) * 100) : 0;
  result.students.withdrawnPct = result.students.total > 0 ? Math.round((result.students.withdrawn / result.students.total) * 100) : 0;

  const gradeLevels = {};
  for (const s of studentsRes.rows) {
    const g = s.current_grade_level || 'Unspecified';
    gradeLevels[g] = (gradeLevels[g] || 0) + 1;
  }
  result.students.byGradeLevel = gradeLevels;

  const genderDist = {};
  for (const s of studentsRes.rows) {
    const g = s.sex || 'Unknown';
    genderDist[g] = (genderDist[g] || 0) + 1;
  }
  result.students.byGender = genderDist;

  const specialEd = studentsRes.rows.filter(s => s.special_education_flag === 1).length;
  const esl = studentsRes.rows.filter(s => s.esl_flag === 1).length;
  const gifted = studentsRes.rows.filter(s => s.gifted_talented_flag === 1).length;
  const freeLunch = studentsRes.rows.filter(s => s.free_lunch_eligible === 1).length;
  result.students.programs = { specialEducation: specialEd, esl, giftedTalented: gifted, freeLunchEligible: freeLunch };

  // STAFF METRICS - Direct query
  const staffRes = ctx.db.query('SELECT * FROM staff');
  result.staff = {
    total: staffRes.rows.length,
    active: staffRes.rows.filter(s => s.employment_status === 'active').length,
    terminated: staffRes.rows.filter(s => s.employment_status === 'terminated').length
  };
  result.staff.activePct = result.staff.total > 0 ? Math.round((result.staff.active / result.staff.total) * 100) : 0;

  const deptDist = {};
  for (const s of staffRes.rows) {
    const d = s.department || 'Unspecified';
    deptDist[d] = (deptDist[d] || 0) + 1;
  }
  result.staff.byDepartment = deptDist;

  const dbsPending = staffRes.rows.filter(s => s.dbs_check_status === 'pending').length;
  const dbsExpired = staffRes.rows.filter(s => s.dbs_expiry_date && new Date(s.dbs_expiry_date) < new Date()).length;
  result.staff.compliance = { dbsPending, dbsExpired };

  // ROOM METRICS - Direct query
  const roomsRes = ctx.db.query('SELECT * FROM rooms');
  result.rooms = {
    total: roomsRes.rows.length,
    available: roomsRes.rows.filter(r => r.status === 'available').length,
    blocked: roomsRes.rows.filter(r => r.status === 'blocked').length
  };
  result.rooms.availPct = result.rooms.total > 0 ? Math.round((result.rooms.available / result.rooms.total) * 100) : 0;

  const roomTypes = {};
  for (const r of roomsRes.rows) {
    const t = r.room_type || 'general';
    roomTypes[t] = (roomTypes[t] || 0) + 1;
  }
  result.rooms.byType = roomTypes;

  const totalCap = roomsRes.rows.reduce((sum, r) => sum + (parseInt(r.capacity) || 0), 0);
  result.rooms.avgCapacity = roomsRes.rows.length > 0 ? Math.round(totalCap / roomsRes.rows.length) : 0;

  // INVENTORY METRICS - Direct query
  const invRes = ctx.db.query('SELECT * FROM inventory_items');
  result.inventory = {
    total: invRes.rows.length,
    available: invRes.rows.filter(i => i.status === 'available').length,
    retired: invRes.rows.filter(i => i.status === 'retired').length
  };
  result.inventory.availPct = result.inventory.total > 0 ? Math.round((result.inventory.available / result.inventory.total) * 100) : 0;

  const cats = {};
  for (const i of invRes.rows) {
    const c = i.category || 'Uncategorized';
    cats[c] = (cats[c] || 0) + 1;
  }
  result.inventory.byCategory = cats;

  const assignedStaff = invRes.rows.filter(i => i.assigned_to_staff_id).length;
  const assignedStud = invRes.rows.filter(i => i.assigned_to_student_id).length;
  result.inventory.assigned = {
    toStaff: assignedStaff,
    toStudents: assignedStud,
    unassigned: invRes.rows.length - assignedStaff - assignedStud
  };

  return result;
}

async function getRatios(req, ctx) {
  const m = await getAllMetrics(req, ctx);

  return {
    studentToStaff: m.staff.active > 0 ? (m.students.active / m.staff.active).toFixed(2) + ':1' : 'N/A',
    studentsPerClassroom: m.rooms.available > 0 ? (m.students.active / m.rooms.available).toFixed(1) : 'N/A',
    itemsPerStudent: m.students.active > 0 ? (m.inventory.available / m.students.active).toFixed(2) : 'N/A',
    classroomAvailability: m.rooms.total > 0 ? ((m.rooms.available / m.rooms.total) * 100).toFixed(1) + '%' : 'N/A',
    inventoryRetention: m.inventory.total > 0 ? ((m.inventory.available / m.inventory.total) * 100).toFixed(1) + '%' : 'N/A'
  };
}

async function generateInsights(req, ctx) {
  const m = await getAllMetrics(req, ctx);
  const r = await getRatios(req, ctx);
  const insights = [];

  if (m.students.activePct < 90) {
    insights.push({ id: 'low_enrollment', severity: 'warning', category: 'Students', title: 'Below Target Enrollment', body: 'Only ' + m.students.activePct + '% of students are active' });
  }

  if (m.staff.compliance.dbsExpired > 0) {
    insights.push({ id: 'expired_dbs', severity: 'critical', category: 'Compliance', title: 'Expired DBS Checks', body: m.staff.compliance.dbsExpired + ' staff have expired DBS clearance' });
  }
  if (m.staff.compliance.dbsPending > 0) {
    insights.push({ id: 'pending_dbs', severity: 'warning', category: 'Compliance', title: 'Pending DBS Checks', body: m.staff.compliance.dbsPending + ' staff need DBS clearance before work' });
  }

  if (m.rooms.availPct < 70) {
    insights.push({ id: 'room_shortage', severity: 'warning', category: 'Facilities', title: 'Limited Room Availability', body: 'Only ' + m.rooms.availPct + '% of rooms currently available' });
  }

  var retireRate = m.inventory.total > 0 ? m.inventory.retired / m.inventory.total : 0;
  if (retireRate > 0.3) {
    insights.push({ id: 'high_retirement', severity: 'info', category: 'Inventory', title: 'High Retirement Rate', body: Math.round(retireRate * 100) + '% of inventory retired' });
  }

  const ssRatio = parseFloat(r.studentToStaff.replace(':1', ''));
  if (!isNaN(ssRatio) && ssRatio > 25) {
    insights.push({ id: 'high_student_staff', severity: 'warning', category: 'Resources', title: 'High Student-Staff Ratio', body: 'Ratio is ' + r.studentToStaff + ', exceeds recommended 20:1' });
  }

  const spcRatio = parseFloat(r.studentsPerClassroom);
  if (!isNaN(spcRatio) && spcRatio > 30) {
    insights.push({ id: 'crowded_classrooms', severity: 'info', category: 'Facilities', title: 'High Student Density', body: 'Average ' + r.studentsPerClassroom + ' students per classroom' });
  }

  if (m.students.activePct >= 95) {
    insights.push({ id: 'great_enrollment', severity: 'info', category: 'Students', title: 'Excellent Retention', body: m.students.activePct + '% enrollment stability' });
  }

  return {
    timestamp: new Date().toISOString(),
    metrics: m,
    ratios: r,
    insights,
    summary: {
      total: insights.length,
      critical: insights.filter(i => i.severity === 'critical').length,
      warning: insights.filter(i => i.severity === 'warning').length,
      info: insights.filter(i => i.severity === 'info').length
    }
  };
}

async function getDashboardData(req, ctx) {
  const m = await getAllMetrics(req, ctx);
  const r = await getRatios(req, ctx);

  return {
    timestamp: new Date().toISOString(),
    metrics: m,
    keyMetrics: {
      students: { total: m.students.total, active: m.students.active, retentionRate: m.students.activePct },
      staff: { total: m.staff.total, active: m.staff.active, retentionRate: m.staff.activePct },
      rooms: { total: m.rooms.total, available: m.rooms.available, utilizationRate: m.rooms.availPct },
      inventory: { total: m.inventory.total, available: m.inventory.available, retentionRate: m.inventory.availPct }
    },
    ratios: r,
    distributions: {
      studentsByGrade: m.students.byGradeLevel,
      studentsByGender: m.students.byGender,
      staffByDept: m.staff.byDepartment,
      roomsByType: m.rooms.byType,
      inventoryByCat: m.inventory.byCategory
    },
    alerts: {
      dbsExpired: m.staff.compliance.dbsExpired,
      dbsPending: m.staff.compliance.dbsPending,
      roomsBlocked: m.rooms.blocked
    }
  };
}

let dashboardHTML = null;

function getDashboardHTML() {
  if (!dashboardHTML) {
    const htmlPath = path.join(__dirname, '../../frontend/dashboard/index.html');
    dashboardHTML = fs.readFileSync(htmlPath, 'utf8');
  }
  return dashboardHTML;
}

async function serveDashboard(req, ctx) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: getDashboardHTML()
  };
}

module.exports = {
  boot,
  teardown,
  getAllMetrics,
  getRatios,
  generateInsights,
  getDashboardData,
  serveDashboard
};
