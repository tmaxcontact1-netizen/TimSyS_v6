// Path: /home/tmax/TimSyS_v6/platform/modules/staff_registry/index.js
// Total lines: 335

'use strict';

function boot(ctx) {
  ctx.log.info('staff_registry booting', { module: 'staff_registry' });
}

function teardown(ctx) {
  ctx.log.info('staff_registry tearing down', { module: 'staff_registry' });
}

// ============================================================================
// STAFF — CRUD
// ============================================================================

async function listStaff(req, ctx) {
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
  if (req.query.staff_id) {
    conditions.push('staff_id = ?');
    params.push(req.query.staff_id);
  }
  if (req.query.employment_status) {
    conditions.push('employment_status = ?');
    params.push(req.query.employment_status);
  }
  if (req.query.department) {
    conditions.push('department = ?');
    params.push(req.query.department);
  }
  if (req.query.job_title) {
    conditions.push('job_title LIKE ?');
    params.push('%' + req.query.job_title + '%');
  }
  if (req.query.sex) {
    conditions.push('sex = ?');
    params.push(req.query.sex);
  }
  if (req.query.dbs_check_status) {
    conditions.push('dbs_check_status = ?');
    params.push(req.query.dbs_check_status);
  }

  var where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  var sql = 'SELECT * FROM staff' + where + ' ORDER BY last_name ASC, first_name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = ctx.db.query(sql, params);
  var countSql = 'SELECT COUNT(*) as total FROM staff' + where;
  var countResult = ctx.db.query(countSql, conditions.length > 0 ? params.slice(0, conditions.length) : []);

  return {
    success: true,
    staff: result.rows,
    total: parseInt(countResult.rows[0].total, 10),
    page: page,
    limit: limit
  };
}

async function createStaff(req, ctx) {
  var b = req.body;
  if (!b.staff_id || !b.first_name || !b.last_name || !b.hire_date) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'staff_id, first_name, last_name, and hire_date are required' }
    };
  }

  if (b.sex && b.sex !== 'Male' && b.sex !== 'Female') {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'sex must be Male or Female' }
    };
  }

  var existing = ctx.db.query('SELECT id FROM staff WHERE staff_id = ?', [b.staff_id]);
  if (existing.rows.length > 0) {
    return {
      success: false,
      statusCode: 409,
      error: { code: 'DUPLICATE', message: 'Staff with staff_id "' + b.staff_id + '" already exists' }
    };
  }

  var result = ctx.db.query(
    `INSERT INTO staff (
      staff_id, user_id, first_name, last_name, middle_name, preferred_name,
      date_of_birth, sex, photo_url, nationality, national_insurance_number,
      identity_custom,
      hire_date, termination_date, employment_status, employment_type,
      job_title, department, reports_to_staff_id, pay_grade, work_email, work_phone,
      employment_custom,
      dbs_check_status, dbs_check_date, dbs_expiry_date, dbs_reference_number, dbs_certificate_url,
      background_checks_custom,
      qualifications_summary, qualifications_custom,
      phone_primary, phone_secondary, email_work, email_personal,
      address_line1, address_line2, city, state_province, postal_code, country,
      contact_custom,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      notes, custom_fields
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.staff_id, b.user_id || null, b.first_name, b.last_name, b.middle_name || null, b.preferred_name || null,
      b.date_of_birth || null, b.sex || null, b.photo_url || null, b.nationality || null, b.national_insurance_number || null,
      b.identity_custom || '{}',
      b.hire_date, b.termination_date || null, b.employment_status || 'active', b.employment_type || 'full_time',
      b.job_title || null, b.department || null, b.reports_to_staff_id || null, b.pay_grade || null,
      b.work_email || null, b.work_phone || null,
      b.employment_custom || '{}',
      b.dbs_check_status || 'pending', b.dbs_check_date || null, b.dbs_expiry_date || null,
      b.dbs_reference_number || null, b.dbs_certificate_url || null,
      b.background_checks_custom || '{}',
      b.qualifications_summary || null, b.qualifications_custom || '{}',
      b.phone_primary || null, b.phone_secondary || null, b.email_work || null, b.email_personal || null,
      b.address_line1 || null, b.address_line2 || null, b.city || null,
      b.state_province || null, b.postal_code || null, b.country || null,
      b.contact_custom || '{}',
      b.emergency_contact_name || null, b.emergency_contact_phone || null, b.emergency_contact_relationship || null,
      b.notes || null, b.custom_fields || '{}'
    ]
  );

  var insertedId = result.lastInsertRowid;
  var staff = ctx.db.query('SELECT * FROM staff WHERE id = ?', [insertedId]);

  ctx.events.publish('staff.created', { staffId: insertedId, staffIdText: b.staff_id });

  if (ctx.intelligence) {
    ctx.intelligence.storeMetadata('staff', insertedId.toString(), staff.rows[0]);
  }

  if (ctx.audit) {
    ctx.audit.action('staff.create', req.user.id, {
      entityType: 'staff',
      entityId: insertedId,
      newValue: staff.rows[0]
    });
  }

  return { success: true, staff: staff.rows[0] };
}

async function readStaff(req, ctx) {
  var id = req.params.id;
  var result = ctx.db.query('SELECT * FROM staff WHERE id = ? OR staff_id = ?', [id, id]);

  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff not found' } };
  }

  return { success: true, staff: result.rows[0] };
}

async function updateStaff(req, ctx) {
  var id = req.params.id;
  var b = req.body;

  var existing = ctx.db.query('SELECT * FROM staff WHERE id = ? OR staff_id = ?', [id, id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff not found' } };
  }

  var allowedFields = [
    'first_name', 'last_name', 'middle_name', 'preferred_name', 'date_of_birth', 'sex',
    'photo_url', 'nationality', 'national_insurance_number', 'identity_custom',
    'hire_date', 'termination_date', 'employment_status', 'employment_type',
    'job_title', 'department', 'reports_to_staff_id', 'pay_grade', 'work_email', 'work_phone',
    'employment_custom',
    'dbs_check_status', 'dbs_check_date', 'dbs_expiry_date', 'dbs_reference_number', 'dbs_certificate_url',
    'background_checks_custom',
    'qualifications_summary', 'qualifications_custom',
    'phone_primary', 'phone_secondary', 'email_work', 'email_personal',
    'address_line1', 'address_line2', 'city', 'state_province', 'postal_code', 'country',
    'contact_custom',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    'notes', 'custom_fields', 'user_id'
  ];

  var updates = [];
  var params = [];

  for (var i = 0; i < allowedFields.length; i++) {
    var field = allowedFields[i];
    if (b[field] !== undefined) {
      if (field === 'sex' && b[field] !== 'Male' && b[field] !== 'Female') {
        return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'sex must be Male or Female' } };
      }
      updates.push(field + ' = ?');
      params.push(b[field]);
    }
  }

  if (updates.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } };
  }

  updates.push("updated_at = datetime('now')");
  params.push(existing.rows[0].id);

  ctx.db.query('UPDATE staff SET ' + updates.join(', ') + ' WHERE id = ?', params);

  var updated = ctx.db.query('SELECT * FROM staff WHERE id = ?', [existing.rows[0].id]);

  ctx.events.publish('staff.updated', { staffId: existing.rows[0].id });

  if (ctx.intelligence) {
    ctx.intelligence.storeMetadata('staff', existing.rows[0].id.toString(), updated.rows[0]);
  }

  if (ctx.audit) {
    ctx.audit.action('staff.update', req.user.id, {
      entityType: 'staff',
      entityId: existing.rows[0].id,
      oldValue: existing.rows[0],
      newValue: updated.rows[0]
    });
  }

  return { success: true, staff: updated.rows[0] };
}

async function deleteStaff(req, ctx) {
  var id = req.params.id;
  var existing = ctx.db.query('SELECT * FROM staff WHERE id = ? OR staff_id = ?', [id, id]);

  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff not found' } };
  }

  ctx.db.query("UPDATE staff SET employment_status = 'terminated', termination_date = ?, updated_at = datetime('now') WHERE id = ?", [
    new Date().toISOString().slice(0, 10),
    existing.rows[0].id
  ]);

  ctx.events.publish('staff.terminated', { staffId: existing.rows[0].id });

  if (ctx.audit) {
    ctx.audit.action('staff.terminate', req.user.id, {
      entityType: 'staff',
      entityId: existing.rows[0].id,
      oldValue: existing.rows[0]
    });
  }

  return { success: true, message: 'Staff terminated (soft delete)' };
}

// ============================================================================
// STAFF CERTIFICATIONS
// ============================================================================

async function listCertifications(req, ctx) {
  var staffId = req.params.id;
  var staff = ctx.db.query('SELECT id FROM staff WHERE id = ? OR staff_id = ?', [staffId, staffId]);

  if (staff.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff not found' } };
  }

  var result = ctx.db.query('SELECT * FROM staff_certifications WHERE staff_id = ? ORDER BY expiry_date ASC', [staff.rows[0].id]);

  return { success: true, certifications: result.rows, total: result.rows.length };
}

async function addCertification(req, ctx) {
  var staffId = req.params.id;
  var b = req.body;
  var staff = ctx.db.query('SELECT id FROM staff WHERE id = ? OR staff_id = ?', [staffId, staffId]);

  if (staff.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff not found' } };
  }

  if (!b.certification_name) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'VALIDATION_ERROR', message: 'certification_name is required' }
    };
  }

  var result = ctx.db.query(
    `INSERT INTO staff_certifications (
      staff_id, certification_name, issuing_body, certification_number,
      issue_date, expiry_date, status, document_url, notes,
      certification_custom, custom_fields
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      staff.rows[0].id, b.certification_name, b.issuing_body || null, b.certification_number || null,
      b.issue_date || null, b.expiry_date || null, b.status || 'valid',
      b.document_url || null, b.notes || null,
      b.certification_custom || '{}', b.custom_fields || '{}'
    ]
  );

  var inserted = ctx.db.query('SELECT * FROM staff_certifications WHERE id = ?', [result.lastInsertRowid]);

  ctx.events.publish('staff.certification_added', { staffId: staff.rows[0].id, certificationId: result.lastInsertRowid });

  return { success: true, certification: inserted.rows[0] };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  listStaff: listStaff,
  createStaff: createStaff,
  readStaff: readStaff,
  updateStaff: updateStaff,
  deleteStaff: deleteStaff,
  listCertifications: listCertifications,
  addCertification: addCertification
};