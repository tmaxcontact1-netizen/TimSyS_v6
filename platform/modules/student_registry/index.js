'use strict';

var db = require('../../shared/services/db');

// Shared utility for withdraw/reinstate/permanentDelete
var statusActions = require('../../shared/services/statusActions');

function boot(ctx) {
  ctx.log.info("student_registry booting", { module: "student_registry" });
}

function teardown(ctx) {
  ctx.log.info("student_registry tearing down", { module: "student_registry" });
}

async function student_registry_listStudents(req, ctx) {
  var result = db.query('SELECT * FROM students ORDER BY id DESC');
  return { success: true, students: result.rows || [] };
}

async function student_registry_createStudent(req, ctx) {
  var b = req.body || {};
  if (!b.student_id || !b.first_name || !b.last_name || !b.date_of_birth || !b.sex) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Student ID, first name, last name, date of birth, and sex are required' } };
  }
  var result = db.query(
    "INSERT INTO students (student_id, first_name, last_name, date_of_birth, sex, middle_name, preferred_name, nationality, ethnicity, primary_language, secondary_language, enrollment_date, enrollment_status, current_grade_level, homeroom, school_year, medical_alert_flag, special_education_flag, gifted_talented_flag, esl_flag, photo_url, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    [b.student_id, b.first_name, b.last_name, b.date_of_birth, b.sex, b.middle_name || null, b.preferred_name || null, b.nationality || null, b.ethnicity || null, b.primary_language || null, b.secondary_language || null, b.enrollment_date || null, b.enrollment_status || 'active', b.current_grade_level || null, b.homeroom || null, b.school_year || null, b.medical_alert_flag || 0, b.special_education_flag || 0, b.gifted_talented_flag || 0, b.esl_flag || 0, b.photo_url || null, b.notes || null]
  );
  var id = result.lastInsertRowid || result.insertId;
  if (ctx.audit) {
    ctx.audit.action('student.create', req.user.id, { entityType: 'student', entityId: id, newValue: b });
  }
  if (ctx.events) {
    ctx.events.publish('student.created', { entityId: id, entityType: 'student', __module: 'student_registry' });
  }
  return { success: true, id: id };
}

async function student_registry_readStudent(req, ctx) {
  var id = req.params.id;
  var result = db.query('SELECT * FROM students WHERE id = ? OR student_id = ?', [id, id]);
  if (!result.rows || result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }
  return { success: true, student: result.rows[0] };
}

async function student_registry_updateStudent(req, ctx) {
  var id = req.params.id;
  var existing = db.query('SELECT * FROM students WHERE id = ? OR student_id = ?', [id, id]);
  if (!existing.rows || existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }
  var record = existing.rows[0];
  var b = req.body || {};
  db.query(
    "UPDATE students SET student_id = ?, first_name = ?, last_name = ?, date_of_birth = ?, sex = ?, middle_name = ?, preferred_name = ?, nationality = ?, ethnicity = ?, primary_language = ?, secondary_language = ?, enrollment_date = ?, enrollment_status = ?, current_grade_level = ?, homeroom = ?, school_year = ?, medical_alert_flag = ?, special_education_flag = ?, gifted_talented_flag = ?, esl_flag = ?, photo_url = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    [b.student_id || record.student_id, b.first_name || record.first_name, b.last_name || record.last_name, b.date_of_birth || record.date_of_birth, b.sex || record.sex, b.middle_name !== undefined ? b.middle_name : record.middle_name, b.preferred_name !== undefined ? b.preferred_name : record.preferred_name, b.nationality !== undefined ? b.nationality : record.nationality, b.ethnicity !== undefined ? b.ethnicity : record.ethnicity, b.primary_language !== undefined ? b.primary_language : record.primary_language, b.secondary_language !== undefined ? b.secondary_language : record.secondary_language, b.enrollment_date || record.enrollment_date, b.enrollment_status || record.enrollment_status, b.current_grade_level !== undefined ? b.current_grade_level : record.current_grade_level, b.homeroom !== undefined ? b.homeroom : record.homeroom, b.school_year !== undefined ? b.school_year : record.school_year, b.medical_alert_flag !== undefined ? b.medical_alert_flag : record.medical_alert_flag, b.special_education_flag !== undefined ? b.special_education_flag : record.special_education_flag, b.gifted_talented_flag !== undefined ? b.gifted_talented_flag : record.gifted_talented_flag, b.esl_flag !== undefined ? b.esl_flag : record.esl_flag, b.photo_url !== undefined ? b.photo_url : record.photo_url, b.notes !== undefined ? b.notes : record.notes, record.id]
  );
  if (ctx.audit) {
    ctx.audit.action('student.update', req.user.id, { entityType: 'student', entityId: record.id, oldValue: record, newValue: b });
  }
  if (ctx.events) {
    ctx.events.publish('student.updated', { entityId: record.id, entityType: 'student', __module: 'student_registry' });
  }
  return { success: true };
}

async function student_registry_withdraw(req, ctx) {
  return statusActions.withdraw({"table":"students","altIdField":"student_id","statusField":"enrollment_status","withdrawnValue":"withdrawn","activeValue":"active","entityType":"Student","moduleName":"student_registry"}, req, ctx);
}

async function student_registry_reinstate(req, ctx) {
  return statusActions.reinstate({"table":"students","altIdField":"student_id","statusField":"enrollment_status","withdrawnValue":"withdrawn","activeValue":"active","entityType":"Student","moduleName":"student_registry"}, req, ctx);
}

async function student_registry_permanentDelete(req, ctx) {
  return statusActions.permanentDelete({"table":"students","altIdField":"student_id","statusField":"enrollment_status","withdrawnValue":"withdrawn","activeValue":"active","entityType":"Student","moduleName":"student_registry"}, req, ctx);
}

async function student_registry_listContacts(req, ctx) {
  var id = req.params.id;
  var result = db.query('SELECT * FROM student_contacts WHERE student_id = ? ORDER BY id ASC', [id]);
  return { success: true, contacts: result.rows || [] };
}

async function student_registry_addContact(req, ctx) {
  var id = req.params.id;
  var b = req.body || {};
  db.query(
    "INSERT INTO student_contacts (student_id, contact_type, first_name, last_name, relationship, phone, email, address, is_primary, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    [id, b.contact_type || 'guardian', b.first_name || null, b.last_name || null, b.relationship || null, b.phone || null, b.email || null, b.address || null, b.is_primary || 0, b.notes || null]
  );
  return { success: true };
}

async function student_registry_getEnrollmentHistory(req, ctx) {
  var id = req.params.id;
  var result = db.query('SELECT * FROM student_enrollment_history WHERE student_id = ? ORDER BY school_year DESC', [id]);
  return { success: true, history: result.rows || [] };
}

async function student_registry_importStudents(req, ctx) {
  if (!req.files || !req.files.csv_file) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'CSV file required' } };
  }
  var csvContent = req.files.csv_file.data ? req.files.csv_file.data.toString('utf8') : '';
  var lines = csvContent.split('\n').filter(function(l) { return l.trim(); });
  if (lines.length < 2) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'CSV must have header row and at least one data row' } };
  }
  var headers = lines[0].split(',').map(function(h) { return h.trim(); });
  var imported = 0;
  var errors = [];
  for (var i = 1; i < lines.length; i++) {
    var values = lines[i].split(',').map(function(v) { return v.trim(); });
    var row = {};
    headers.forEach(function(h, idx) { row[h] = values[idx] || null; });
    if (!row.student_id || !row.first_name || !row.last_name || !row.date_of_birth || !row.sex) {
      errors.push('Row ' + (i + 1) + ': missing required fields');
      continue;
    }
    try {
      db.query(
        "INSERT INTO students (student_id, first_name, last_name, date_of_birth, sex, middle_name, preferred_name, nationality, ethnicity, primary_language, secondary_language, enrollment_date, enrollment_status, current_grade_level, homeroom, school_year, medical_alert_flag, special_education_flag, gifted_talented_flag, esl_flag, photo_url, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        [row.student_id, row.first_name, row.last_name, row.date_of_birth, row.sex, row.middle_name || null, row.preferred_name || null, row.nationality || null, row.ethnicity || null, row.primary_language || null, row.secondary_language || null, row.enrollment_date || null, row.enrollment_status || 'active', row.current_grade_level || null, row.homeroom || null, row.school_year || null, row.medical_alert_flag || 0, row.special_education_flag || 0, row.gifted_talented_flag || 0, row.esl_flag || 0, row.photo_url || null, row.notes || null]
      );
      imported++;
    } catch (e) {
      errors.push('Row ' + (i + 1) + ': ' + e.message);
    }
  }
  return { success: true, imported: imported, errors: errors };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  student_registry_listStudents: student_registry_listStudents,
  student_registry_createStudent: student_registry_createStudent,
  student_registry_readStudent: student_registry_readStudent,
  student_registry_updateStudent: student_registry_updateStudent,
  student_registry_withdraw: student_registry_withdraw,
  student_registry_reinstate: student_registry_reinstate,
  student_registry_permanentDelete: student_registry_permanentDelete,
  student_registry_listContacts: student_registry_listContacts,
  student_registry_addContact: student_registry_addContact,
  student_registry_getEnrollmentHistory: student_registry_getEnrollmentHistory,
  student_registry_importStudents: student_registry_importStudents
};
