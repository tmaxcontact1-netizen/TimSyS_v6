// Path: /home/tmax/TimSyS_v6/platform/modules/student_profile/index.js
// Total lines: ~95

'use strict';

const functionRegistry = require('../../shared/registry/functionRegistry');

function boot(ctx) {
  ctx.log.info('student_profile booting', { module: 'student_profile' });
}

function teardown(ctx) {
  ctx.log.info('student_profile tearing down', { module: 'student_profile' });
}

async function getProfile(req, ctx) {
  var id = req.params.id;

  var subReq = { params: { id: id }, query: {}, body: {}, user: req.user };

  var studentFn = functionRegistry.get('student_registry_readStudent');
  if (!studentFn) {
    return { success: false, statusCode: 500, error: { code: 'DEPENDENCY_MISSING', message: 'student_registry_readStudent not available' } };
  }
  var studentResult = await studentFn.implementation(subReq, ctx);
  if (!studentResult.success) {
    return studentResult;
  }

  var contactsFn = functionRegistry.get('student_registry_listContacts');
  var contactsResult = null;
  if (contactsFn) {
    contactsResult = await contactsFn.implementation(subReq, ctx);
  }

  var historyFn = functionRegistry.get('student_registry_getEnrollmentHistory');
  var historyResult = null;
  if (historyFn) {
    historyResult = await historyFn.implementation(subReq, ctx);
  }

  var profile = {
    student: studentResult.student,
    contacts: contactsResult && contactsResult.success ? contactsResult.contacts : [],
    enrollment_history: historyResult && historyResult.success ? historyResult.history : []
  };

  if (ctx.audit) {
    ctx.audit.action('student_profile.view', req.user.id, {
      entityType: 'student',
      entityId: studentResult.student.id
    });
  }

  return { success: true, profile: profile };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  getProfile: getProfile
};