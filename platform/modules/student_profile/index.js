'use strict';

function boot(ctx) {
  ctx.log.info('student_profile booting', { module: 'student_profile' });
}

function teardown(ctx) {
  ctx.log.info('student_profile tearing down', { module: 'student_profile' });
}

async function listProfiles(req, ctx) {
  var listFunc = ctx.functionRegistry.get('student_registry_listStudents');
  if (!listFunc || typeof listFunc.implementation !== 'function') {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'student_registry not available' } };
  }
  var result = await listFunc.implementation(req, ctx);
  return result;
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

  var studentEntityId = studentResult.student.id !== undefined ? studentResult.student.id.toString() : id;

  var profile = {
    student: studentResult.student,
    contacts: [],
    enrollment_history: [],
    decisions: [],
    events: [],
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

  if (ctx.decisionLog) {
    try {
      profile.decisions = ctx.decisionLog.getByEntity('student', studentEntityId, 20);
    } catch (e) {
      ctx.log.warn('Failed to fetch decisions', { error: e.message });
    }
  }

  if (ctx.eventStore) {
    try {
      profile.events = ctx.eventStore.getByEntity('student', studentEntityId, 20);
    } catch (e) {
      ctx.log.warn('Failed to fetch events', { error: e.message });
    }
  }

  if (ctx.intelligence) {
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

module.exports = {
  boot: boot,
  teardown: teardown,
  listProfiles: listProfiles,
  getProfile: getProfile
};
