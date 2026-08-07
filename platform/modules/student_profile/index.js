// Path: /home/tmax/TimSyS_v6/platform/modules/student_profile/index.js
// Total lines: 110

'use strict';

function boot(ctx) {
  ctx.log.info('student_profile booting', { module: 'student_profile' });
}

function teardown(ctx) {
  ctx.log.info('student_profile tearing down', { module: 'student_profile' });
}

async function getProfile(req, ctx) {
  var id = req.params.id;
  
  var studentFunc = ctx.functionRegistry.get('student_registry_readStudent');
  if (!studentFunc || typeof studentFunc.implementation !== 'function') {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'student_registry not available' } };
  }
  
  var studentReq = { params: { id: id } };
  var studentResult = await studentFunc.implementation(studentReq, ctx);
  
  if (!studentResult.success) {
    return studentResult;
  }
  
  var profile = {
    student: studentResult.student,
    contacts: [],
    enrollment_history: [],
    metadata: null,
    insights: []
  };
  
  var contactsFunc = ctx.functionRegistry.get('student_registry_listContacts');
  if (contactsFunc && typeof contactsFunc.implementation === 'function') {
    var contactsResult = await contactsFunc.implementation({ params: { id: id } }, ctx);
    if (contactsResult && contactsResult.success) {
      profile.contacts = contactsResult.contacts;
    }
  }
  
  var historyFunc = ctx.functionRegistry.get('student_registry_getEnrollmentHistory');
  if (historyFunc && typeof historyFunc.implementation === 'function') {
    var historyResult = await historyFunc.implementation({ params: { id: id } }, ctx);
    if (historyResult && historyResult.success) {
      profile.enrollment_history = historyResult.history;
    }
  }
  
  if (ctx.intelligence) {
    var studentEntityId = studentResult.student.id !== undefined ? studentResult.student.id.toString() : (studentResult.student.student_id || id);
    
    try {
      profile.metadata = await ctx.intelligence.getMetadata('student', studentEntityId);
    } catch (e) {
      ctx.log.warn('Failed to fetch metadata', { error: e.message });
    }
    
    try {
      profile.insights = await ctx.intelligence.getInsights('student', studentEntityId);
    } catch (e) {
      ctx.log.warn('Failed to fetch insights', { error: e.message });
    }
  }
  
  return { success: true, profile: profile };
}

module.exports = { boot: boot, teardown: teardown, getProfile: getProfile };