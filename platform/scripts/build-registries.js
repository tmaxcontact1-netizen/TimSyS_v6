'use strict';

const assembler = require('../modules/builder/assembler');

// === Student Registry ===
var studentSpec = {
  name: 'student_registry',
  components: [],
  version: '1.0.0',
  author: 'admin',
  statusConfig: {
    table: 'students',
    altIdField: 'student_id',
    statusField: 'enrollment_status',
    withdrawnValue: 'withdrawn',
    activeValue: 'active',
    entityType: 'Student',
    moduleName: 'student_registry'
  },
  routes: [
    { path: '/students', method: 'GET', handler: 'student_registry_listStudents', auth_required: true },
    { path: '/students', method: 'POST', handler: 'student_registry_createStudent', auth_required: true },
    { path: '/students/:id', method: 'GET', handler: 'student_registry_readStudent', auth_required: true },
    { path: '/students/:id', method: 'PUT', handler: 'student_registry_updateStudent', auth_required: true },
    { path: '/students/:id/withdraw', method: 'PUT', handler: 'student_registry_withdraw', auth_required: true },
    { path: '/students/:id/reinstate', method: 'PUT', handler: 'student_registry_reinstate', auth_required: true },
    { path: '/students/:id/permanent', method: 'DELETE', handler: 'student_registry_permanentDelete', auth_required: true },
    { path: '/students/:id/contacts', method: 'GET', handler: 'student_registry_listContacts', auth_required: true },
    { path: '/students/:id/contacts', method: 'POST', handler: 'student_registry_addContact', auth_required: true },
    { path: '/students/:id/enrollment-history', method: 'GET', handler: 'student_registry_getEnrollmentHistory', auth_required: true },
    { path: '/api/students/import', method: 'POST', handler: 'student_registry_importStudents', auth_required: true }
  ],
  events: {
    publishes: ['student.created', 'student.updated', 'student.withdrawn', 'student.reinstated', 'student.deleted_permanently'],
    subscribes: []
  }
};

var studentResult = assembler.assemble(studentSpec);
console.log('Student Registry:');
console.log(JSON.stringify(studentResult, null, 2));

// === Staff Registry ===
var staffSpec = {
  name: 'staff_registry',
  components: [],
  version: '1.0.0',
  author: 'admin',
  statusConfig: {
    table: 'staff',
    altIdField: 'staff_id',
    statusField: 'employment_status',
    withdrawnValue: 'terminated',
    activeValue: 'active',
    entityType: 'Staff',
    moduleName: 'staff_registry'
  },
  routes: [
    { path: '/staff', method: 'GET', handler: 'staff_registry_listStaff', auth_required: true },
    { path: '/staff', method: 'POST', handler: 'staff_registry_createStaff', auth_required: true },
    { path: '/staff/:id', method: 'GET', handler: 'staff_registry_readStaff', auth_required: true },
    { path: '/staff/:id', method: 'PUT', handler: 'staff_registry_updateStaff', auth_required: true },
    { path: '/staff/:id/withdraw', method: 'PUT', handler: 'staff_registry_withdraw', auth_required: true },
    { path: '/staff/:id/reinstate', method: 'PUT', handler: 'staff_registry_reinstate', auth_required: true },
    { path: '/staff/:id/permanent', method: 'DELETE', handler: 'staff_registry_permanentDelete', auth_required: true },
    { path: '/staff/:id/certifications', method: 'GET', handler: 'staff_registry_listCertifications', auth_required: true },
    { path: '/staff/:id/certifications', method: 'POST', handler: 'staff_registry_addCertification', auth_required: true },
    { path: '/api/staff/import', method: 'POST', handler: 'staff_registry_importStaff', auth_required: true }
  ],
  events: {
    publishes: ['staff.created', 'staff.updated', 'staff.withdrawn', 'staff.reinstated', 'staff.deleted_permanently'],
    subscribes: []
  }
};

var staffResult = assembler.assemble(staffSpec);
console.log('\nStaff Registry:');
console.log(JSON.stringify(staffResult, null, 2));
