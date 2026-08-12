'use strict';

var statusActions = require('../../shared/services/statusActions');
var csvParser = require('../../shared/services/csv_parser');

function boot(ctx) {
  ctx.log.info('student_registry booting', { module: 'student_registry' });
}

function teardown(ctx) {
  ctx.log.info('student_registry tearing down', { module: 'student_registry' });
}

async function listStudents(req, ctx) {
  var page = parseInt(req.query.page, 10) || 1;
  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = (page - 1) * limit;

  var conditions = [];
  var params = [];

  if (req.query.last_name) {
    conditions.push('last_name LIKE ?');
    params.push('%' + req.query.last_name + '%');
  }
  if (req.query.first_name) {
    conditions.push('first_name LIKE ?');
    params.push('%' + req.query.first_name + '%');
  }
  if (req.query.student_id) {
    conditions.push('student_id = ?');
    params.push(req.query.student_id);
  }
  if (req.query.enrollment_status) {
    conditions.push('enrollment_status = ?');
    params.push(req.query.enrollment_status);
  }
  if (req.query.grade_level) {
    conditions.push('current_grade_level = ?');
    params.push(req.query.grade_level);
  }
  if (req.query.sex) {
    conditions.push('sex = ?');
    params.push(req.query.sex);
  }

  var where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  var sql = 'SELECT * FROM students' + where + ' ORDER BY last_name ASC, first_name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = ctx.db.query(sql, params);
  var countSql = 'SELECT COUNT(*) as total FROM students' + where;
  var countResult = ctx.db.query(countSql, conditions.length > 0 ? params.slice(0, conditions.length) : []);

  return {
    success: true,
    students: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    page: page,
    limit: limit
  };
}

async function createStudent(req, ctx) {
  var b = req.body;
  if (!b.student_id || !b.first_name || !b.last_name || !b.date_of_birth || !b.sex) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'student_id, first_name, last_name, date_of_birth, and sex are required' }
    };
  }

  if (b.sex !== 'Male' && b.sex !== 'Female') {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'sex must be Male or Female' }
    };
  }

  var existing = ctx.db.query('SELECT id FROM students WHERE student_id = ?', [b.student_id]);
  if (existing.rows.length > 0) {
    return {
      success: false,
      statusCode: 409,
      error: { code: 'DUPLICATE', message: 'Student with student_id "' + b.student_id + '" already exists' }
    };
  }

  var result = ctx.db.query(
    "INSERT INTO students (student_id, first_name, last_name, middle_name, preferred_name, date_of_birth, sex, photo_url, nationality, ethnicity, primary_language, secondary_language, identity_custom, enrollment_date, enrollment_status, current_grade_level, homeroom, term_start, term_end, school_year, enrollment_custom, medical_alert_flag, special_education_flag, free_lunch_eligible, gifted_talented_flag, esl_flag, notes, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      b.student_id, b.first_name, b.last_name, b.middle_name || null, b.preferred_name || null,
      b.date_of_birth, b.sex, b.photo_url || null, b.nationality || null, b.ethnicity || null,
      b.primary_language || null, b.secondary_language || null, b.identity_custom || '{}',
      b.enrollment_date || new Date().toISOString().slice(0, 10),
      b.enrollment_status || 'active', b.current_grade_level || null, b.homeroom || null,
      b.term_start || null, b.term_end || null, b.school_year || null, b.enrollment_custom || '{}',
      b.medical_alert_flag === true ? 1 : 0, b.special_education_flag === true ? 1 : 0, b.free_lunch_eligible === true ? 1 : 0,
      b.gifted_talented_flag === true ? 1 : 0, b.esl_flag === true ? 1 : 0,
      b.notes || null, b.custom_fields || '{}'
    ]
  );

  var insertedId = result.lastInsertRowid;
  var student = ctx.db.query('SELECT * FROM students WHERE id = ?', [insertedId]);

  ctx.events.publish('student.created', { studentId: insertedId, studentIdText: b.student_id, entityType: 'student', entityId: insertedId, record: student.rows[0], actorId: req.user.id, __module: 'student_registry' });

  if (ctx.intelligence) {
    try { ctx.intelligence.storeMetadata('student', insertedId.toString(), student.rows[0]); } catch (e) {}
  }

  if (ctx.audit) {
    ctx.audit.action('student.create', req.user.id, { entityType: 'student', entityId: insertedId, newValue: student.rows[0] });
  }

  return { success: true, student: student.rows[0] };
}

async function readStudent(req, ctx) {
  var id = req.params.id;
  var result = ctx.db.query('SELECT * FROM students WHERE id = ? OR student_id = ?', [id, id]);

  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }

  return { success: true, student: result.rows[0] };
}

async function updateStudent(req, ctx) {
  var id = req.params.id;
  var b = req.body;

  var existing = ctx.db.query('SELECT * FROM students WHERE id = ? OR student_id = ?', [id, id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }

  var allowedFields = ['first_name', 'last_name', 'middle_name', 'preferred_name', 'date_of_birth', 'sex', 'photo_url', 'nationality', 'ethnicity', 'primary_language', 'secondary_language', 'identity_custom', 'enrollment_date', 'enrollment_status', 'current_grade_level', 'homeroom', 'term_start', 'term_end', 'school_year', 'enrollment_custom', 'medical_alert_flag', 'special_education_flag', 'free_lunch_eligible', 'gifted_talented_flag', 'esl_flag', 'notes', 'custom_fields'];

  var updates = [];
  var params = [];

  for (var i = 0; i < allowedFields.length; i++) {
    var field = allowedFields[i];
    if (b[field] !== undefined) {
      if (field === 'sex' && b[field] !== 'Male' && b[field] !== 'Female') {
        return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'sex must be Male or Female' } };
      }
      if (['medical_alert_flag', 'special_education_flag', 'free_lunch_eligible', 'gifted_talented_flag', 'esl_flag'].indexOf(field) !== -1) {
        params.push(b[field] === true ? 1 : 0);
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

  ctx.db.query('UPDATE students SET ' + updates.join(', ') + ' WHERE id = ?', params);

  var updated = ctx.db.query('SELECT * FROM students WHERE id = ?', [existing.rows[0].id]);

  ctx.events.publish('student.updated', { studentId: existing.rows[0].id, entityType: 'student', entityId: existing.rows[0].id, record: updated.rows[0], actorId: req.user.id, __module: 'student_registry' });

  if (ctx.intelligence) {
    try { ctx.intelligence.storeMetadata('student', existing.rows[0].id.toString(), updated.rows[0]); } catch (e) {}
  }

  if (ctx.audit) {
    ctx.audit.action('student.update', req.user.id, { entityType: 'student', entityId: existing.rows[0].id, oldValue: existing.rows[0], newValue: updated.rows[0] });
  }

  return { success: true, student: updated.rows[0] };
}

var statusConfig = {
  "table": "students",
  "altIdField": "student_id",
  "statusField": "enrollment_status",
  "withdrawnValue": "withdrawn",
  "activeValue": "active",
  "entityType": "Student",
  "moduleName": "student_registry"
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

async function listContacts(req, ctx) {
  var studentId = req.params.id;
  var student = ctx.db.query('SELECT id FROM students WHERE id = ? OR student_id = ?', [studentId, studentId]);

  if (student.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }

  var result = ctx.db.query('SELECT * FROM student_contacts WHERE student_id = ? ORDER BY is_primary_contact DESC, last_name ASC', [student.rows[0].id]);

  return { success: true, contacts: result.rows, total: result.rows.length };
}

async function addContact(req, ctx) {
  var studentId = req.params.id;
  var b = req.body;
  var student = ctx.db.query('SELECT id FROM students WHERE id = ? OR student_id = ?', [studentId, studentId]);

  if (student.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }

  if (!b.first_name || !b.last_name || !b.contact_type) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'contact_type, first_name, and last_name are required' } };
  }

  if (b.is_primary_contact) {
    ctx.db.query('UPDATE student_contacts SET is_primary_contact = 0 WHERE student_id = ?', [student.rows[0].id]);
  }

  var result = ctx.db.query(
    "INSERT INTO student_contacts (student_id, contact_type, first_name, last_name, relationship, phone_primary, phone_secondary, email, address_line1, address_line2, city, state_province, postal_code, country, is_primary_contact, has_custody, pickup_authorization, employer, occupation, notes, contact_custom, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [student.rows[0].id, b.contact_type, b.first_name, b.last_name, b.relationship || null, b.phone_primary || null, b.phone_secondary || null, b.email || null, b.address_line1 || null, b.address_line2 || null, b.city || null, b.state_province || null, b.postal_code || null, b.country || null, b.is_primary_contact === true ? 1 : 0, b.has_custody === true ? 1 : 0, b.pickup_authorization === true ? 1 : 0, b.employer || null, b.occupation || null, b.notes || null, JSON.stringify(b.contact_custom || {}), JSON.stringify(b.custom_fields || {})]
  );

  var inserted = ctx.db.query('SELECT * FROM student_contacts WHERE id = ?', [result.lastInsertRowid]);

  ctx.events.publish('student.contact_added', { studentId: student.rows[0].id, contactId: result.lastInsertRowid, entityType: 'student', entityId: student.rows[0].id, __module: 'student_registry' });

  return { success: true, contact: inserted.rows[0] };
}

async function getEnrollmentHistory(req, ctx) {
  var studentId = req.params.id;
  var student = ctx.db.query('SELECT id FROM students WHERE id = ? OR student_id = ?', [studentId, studentId]);

  if (student.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }

  var result = ctx.db.query('SELECT * FROM student_enrollment_history WHERE student_id = ? ORDER BY academic_year DESC', [student.rows[0].id]);

  return { success: true, history: result.rows, total: result.rows.length };
}

var studentColumnMap = {
  'studentid': 'student_id', 'id': 'student_id', 'studentnumber': 'student_id',
  'firstname': 'first_name', 'givenname': 'first_name', 'fname': 'first_name',
  'lastname': 'last_name', 'surname': 'last_name', 'lname': 'last_name',
  'dateofbirth': 'date_of_birth', 'dob': 'date_of_birth', 'birthdate': 'date_of_birth',
  'sex': 'sex', 'gender': 'sex',
  'enrollmentstatus': 'enrollment_status', 'status': 'enrollment_status',
  'currentgradelevel': 'current_grade_level', 'grade': 'current_grade_level', 'homeroom': 'homeroom',
  'notes': 'notes'
};

async function importStudents(req, ctx) {
  var body = req.body || {};
  if (!body.csv) return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'CSV data required' } };
  
  var parsed = csvParser.parse(Buffer.from(body.csv));
  var mapped = csvParser.mapRows(parsed.rows, studentColumnMap);
  var inserted = 0, skipped = 0, errors = [];
  
  for (var i = 0; i < mapped.length; i++) {
    var m = mapped[i].mapped;
    if (!m.student_id || !m.first_name || !m.last_name || !m.date_of_birth || !m.sex) {
      errors.push({ row: i + 2, reason: 'Missing required field' });
      skipped++;
      continue;
    }
    var sexVal = m.sex === 'M' ? 'Male' : m.sex === 'F' ? 'Female' : m.sex;
    var existing = ctx.db.query('SELECT id FROM students WHERE student_id = ?', [m.student_id]);
    if (existing.rows.length > 0) {
      errors.push({ row: i + 2, reason: 'Duplicate student_id: ' + m.student_id });
      skipped++;
      continue;
    }
    try {
      ctx.db.query(
        'INSERT INTO students (student_id, first_name, last_name, date_of_birth, sex, enrollment_date, enrollment_status, current_grade_level, homeroom, notes, identity_custom, enrollment_custom, custom_fields, medical_alert_flag, special_education_flag, free_lunch_eligible, gifted_talented_flag, esl_flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [m.student_id, m.first_name, m.last_name, m.date_of_birth, sexVal, m.enrollment_date || new Date().toISOString().slice(0,10), m.enrollment_status || 'active', m.current_grade_level || null, m.homeroom || null, m.notes || null, '{}', '{}', '{}', 0, 0, 0, 0, 0]
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
  listStudents: listStudents,
  createStudent: createStudent,
  readStudent: readStudent,
  updateStudent: updateStudent,
  withdraw: withdraw,
  reinstate: reinstate,
  permanentDelete: permanentDelete,
  listContacts: listContacts,
  addContact: addContact,
  getEnrollmentHistory: getEnrollmentHistory,
  importStudents: importStudents
};
