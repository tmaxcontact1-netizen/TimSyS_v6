'use strict';

var db = require('../../shared/services/db');

// Shared utility for withdraw/reinstate/permanentDelete
var statusActions = require('../../shared/services/statusActions');

function boot(ctx) {
  ctx.log.info("staff_registry booting", { module: "staff_registry" });
}

function teardown(ctx) {
  ctx.log.info("staff_registry tearing down", { module: "staff_registry" });
}

async function staff_registry_listStaff(req, ctx) {
  var result = db.query('SELECT * FROM staff ORDER BY id DESC');
  return { success: true, staff: result.rows || [] };
}

async function staff_registry_createStaff(req, ctx) {
  var b = req.body || {};
  if (!b.staff_id || !b.first_name || !b.last_name || !b.hire_date || !b.employment_type) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Staff ID, first name, last name, hire date, and employment type are required' } };
  }
  var result = db.query(
    "INSERT INTO staff (staff_id, first_name, last_name, hire_date, employment_type, job_title, middle_name, preferred_name, date_of_birth, sex, nationality, national_insurance_number, department, work_email, work_phone, phone_primary, phone_secondary, email_work, email_personal, dbs_check_status, dbs_check_date, dbs_expiry_date, qualifications_summary, address_line1, address_line2, city, postal_code, country, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, employment_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    [b.staff_id, b.first_name, b.last_name, b.hire_date, b.employment_type, b.job_title || null, b.middle_name || null, b.preferred_name || null, b.date_of_birth || null, b.sex || null, b.nationality || null, b.national_insurance_number || null, b.department || null, b.work_email || null, b.work_phone || null, b.phone_primary || null, b.phone_secondary || null, b.email_work || null, b.email_personal || null, b.dbs_check_status || 'pending', b.dbs_check_date || null, b.dbs_expiry_date || null, b.qualifications_summary || null, b.address_line1 || null, b.address_line2 || null, b.city || null, b.postal_code || null, b.country || null, b.emergency_contact_name || null, b.emergency_contact_phone || null, b.emergency_contact_relationship || null, 'active', b.notes || null]
  );
  var id = result.lastInsertRowid || result.insertId;
  if (ctx.audit) {
    ctx.audit.action('staff.create', req.user.id, { entityType: 'staff', entityId: id, newValue: b });
  }
  if (ctx.events) {
    ctx.events.publish('staff.created', { entityId: id, entityType: 'staff', __module: 'staff_registry' });
  }
  return { success: true, id: id };
}

async function staff_registry_readStaff(req, ctx) {
  var id = req.params.id;
  var result = db.query('SELECT * FROM staff WHERE id = ? OR staff_id = ?', [id, id]);
  if (!result.rows || result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff member not found' } };
  }
  return { success: true, staff: result.rows[0] };
}

async function staff_registry_updateStaff(req, ctx) {
  var id = req.params.id;
  var existing = db.query('SELECT * FROM staff WHERE id = ? OR staff_id = ?', [id, id]);
  if (!existing.rows || existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff member not found' } };
  }
  var record = existing.rows[0];
  var b = req.body || {};
  db.query(
    "UPDATE staff SET staff_id = ?, first_name = ?, last_name = ?, hire_date = ?, employment_type = ?, job_title = ?, middle_name = ?, preferred_name = ?, date_of_birth = ?, sex = ?, nationality = ?, national_insurance_number = ?, department = ?, work_email = ?, work_phone = ?, phone_primary = ?, phone_secondary = ?, email_work = ?, email_personal = ?, dbs_check_status = ?, dbs_check_date = ?, dbs_expiry_date = ?, qualifications_summary = ?, address_line1 = ?, address_line2 = ?, city = ?, postal_code = ?, country = ?, emergency_contact_name = ?, emergency_contact_phone = ?, emergency_contact_relationship = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    [b.staff_id || record.staff_id, b.first_name || record.first_name, b.last_name || record.last_name, b.hire_date || record.hire_date, b.employment_type || record.employment_type, b.job_title !== undefined ? b.job_title : record.job_title, b.middle_name !== undefined ? b.middle_name : record.middle_name, b.preferred_name !== undefined ? b.preferred_name : record.preferred_name, b.date_of_birth !== undefined ? b.date_of_birth : record.date_of_birth, b.sex !== undefined ? b.sex : record.sex, b.nationality !== undefined ? b.nationality : record.nationality, b.national_insurance_number !== undefined ? b.national_insurance_number : record.national_insurance_number, b.department !== undefined ? b.department : record.department, b.work_email !== undefined ? b.work_email : record.work_email, b.work_phone !== undefined ? b.work_phone : record.work_phone, b.phone_primary !== undefined ? b.phone_primary : record.phone_primary, b.phone_secondary !== undefined ? b.phone_secondary : record.phone_secondary, b.email_work !== undefined ? b.email_work : record.email_work, b.email_personal !== undefined ? b.email_personal : record.email_personal, b.dbs_check_status !== undefined ? b.dbs_check_status : record.dbs_check_status, b.dbs_check_date !== undefined ? b.dbs_check_date : record.dbs_check_date, b.dbs_expiry_date !== undefined ? b.dbs_expiry_date : record.dbs_expiry_date, b.qualifications_summary !== undefined ? b.qualifications_summary : record.qualifications_summary, b.address_line1 !== undefined ? b.address_line1 : record.address_line1, b.address_line2 !== undefined ? b.address_line2 : record.address_line2, b.city !== undefined ? b.city : record.city, b.postal_code !== undefined ? b.postal_code : record.postal_code, b.country !== undefined ? b.country : record.country, b.emergency_contact_name !== undefined ? b.emergency_contact_name : record.emergency_contact_name, b.emergency_contact_phone !== undefined ? b.emergency_contact_phone : record.emergency_contact_phone, b.emergency_contact_relationship !== undefined ? b.emergency_contact_relationship : record.emergency_contact_relationship, b.notes !== undefined ? b.notes : record.notes, record.id]
  );
  if (ctx.audit) {
    ctx.audit.action('staff.update', req.user.id, { entityType: 'staff', entityId: record.id, oldValue: record, newValue: b });
  }
  if (ctx.events) {
    ctx.events.publish('staff.updated', { entityId: record.id, entityType: 'staff', __module: 'staff_registry' });
  }
  return { success: true };
}

async function staff_registry_withdraw(req, ctx) {
  return statusActions.withdraw({"table":"staff","altIdField":"staff_id","statusField":"employment_status","withdrawnValue":"terminated","activeValue":"active","entityType":"Staff","moduleName":"staff_registry"}, req, ctx);
}

async function staff_registry_reinstate(req, ctx) {
  return statusActions.reinstate({"table":"staff","altIdField":"staff_id","statusField":"employment_status","withdrawnValue":"terminated","activeValue":"active","entityType":"Staff","moduleName":"staff_registry"}, req, ctx);
}

async function staff_registry_permanentDelete(req, ctx) {
  return statusActions.permanentDelete({"table":"staff","altIdField":"staff_id","statusField":"employment_status","withdrawnValue":"terminated","activeValue":"active","entityType":"Staff","moduleName":"staff_registry"}, req, ctx);
}

async function staff_registry_listCertifications(req, ctx) {
  var id = req.params.id;
  var result = db.query('SELECT * FROM staff_certifications WHERE staff_id = ? ORDER BY id ASC', [id]);
  return { success: true, certifications: result.rows || [] };
}

async function staff_registry_addCertification(req, ctx) {
  var id = req.params.id;
  var b = req.body || {};
  db.query(
    "INSERT INTO staff_certifications (staff_id, certification_name, issuing_body, date_obtained, expiry_date, certificate_number, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    [id, b.certification_name || null, b.issuing_body || null, b.date_obtained || null, b.expiry_date || null, b.certificate_number || null, b.notes || null]
  );
  return { success: true };
}

async function staff_registry_importStaff(req, ctx) {
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
    if (!row.staff_id || !row.first_name || !row.last_name || !row.hire_date || !row.employment_type) {
      errors.push('Row ' + (i + 1) + ': missing required fields');
      continue;
    }
    try {
      db.query(
        "INSERT INTO staff (staff_id, first_name, last_name, hire_date, employment_type, job_title, middle_name, preferred_name, date_of_birth, sex, nationality, national_insurance_number, department, work_email, work_phone, phone_primary, phone_secondary, email_work, email_personal, dbs_check_status, dbs_check_date, dbs_expiry_date, qualifications_summary, address_line1, address_line2, city, postal_code, country, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, employment_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        [row.staff_id, row.first_name, row.last_name, row.hire_date, row.employment_type, row.job_title || null, row.middle_name || null, row.preferred_name || null, row.date_of_birth || null, row.sex || null, row.nationality || null, row.national_insurance_number || null, row.department || null, row.work_email || null, row.work_phone || null, row.phone_primary || null, row.phone_secondary || null, row.email_work || null, row.email_personal || null, row.dbs_check_status || 'pending', row.dbs_check_date || null, row.dbs_expiry_date || null, row.qualifications_summary || null, row.address_line1 || null, row.address_line2 || null, row.city || null, row.postal_code || null, row.country || null, row.emergency_contact_name || null, row.emergency_contact_phone || null, row.emergency_contact_relationship || null, 'active', row.notes || null]
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
  staff_registry_listStaff: staff_registry_listStaff,
  staff_registry_createStaff: staff_registry_createStaff,
  staff_registry_readStaff: staff_registry_readStaff,
  staff_registry_updateStaff: staff_registry_updateStaff,
  staff_registry_withdraw: staff_registry_withdraw,
  staff_registry_reinstate: staff_registry_reinstate,
  staff_registry_permanentDelete: staff_registry_permanentDelete,
  staff_registry_listCertifications: staff_registry_listCertifications,
  staff_registry_addCertification: staff_registry_addCertification,
  staff_registry_importStaff: staff_registry_importStaff
};
