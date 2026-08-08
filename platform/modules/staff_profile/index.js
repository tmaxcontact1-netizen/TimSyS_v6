'use strict';

function boot(ctx) {
  ctx.log.info('staff_profile booting', { module: 'staff_profile' });
}

function teardown(ctx) {
  ctx.log.info('staff_profile tearing down', { module: 'staff_profile' });
}

async function listProfiles(req, ctx) {
  var listFunc = ctx.functionRegistry.get('staff_registry_listStaff');
  if (!listFunc || typeof listFunc.implementation !== 'function') {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'staff_registry not available' } };
  }
  var result = await listFunc.implementation(req, ctx);
  return result;
}

async function getProfile(req, ctx) {
  var id = req.params.id;

  var staffFunc = ctx.functionRegistry.get('staff_registry_readStaff');
  if (!staffFunc || typeof staffFunc.implementation !== 'function') {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'staff_registry not available' } };
  }

  var staffReq = { params: { id: id } };
  var staffResult = await staffFunc.implementation(staffReq, ctx);

  if (!staffResult.success) {
    return staffResult;
  }

  var staffEntityId = staffResult.staff.id !== undefined ? staffResult.staff.id.toString() : id;

  var profile = {
    staff: staffResult.staff,
    certifications: [],
    decisions: [],
    events: [],
    metadata: null,
    insights: []
  };

  var certsFunc = ctx.functionRegistry.get('staff_registry_listCertifications');
  if (certsFunc && typeof certsFunc.implementation === 'function') {
    var certsResult = await certsFunc.implementation({ params: { id: id } }, ctx);
    if (certsResult && certsResult.success) {
      profile.certifications = certsResult.certifications;
    }
  }

  if (ctx.decisionLog) {
    try {
      profile.decisions = ctx.decisionLog.getByEntity('staff', staffEntityId, 20);
    } catch (e) {
      ctx.log.warn('Failed to fetch decisions', { error: e.message });
    }
  }

  if (ctx.eventStore) {
    try {
      profile.events = ctx.eventStore.getByEntity('staff', staffEntityId, 20);
    } catch (e) {
      ctx.log.warn('Failed to fetch events', { error: e.message });
    }
  }

  if (ctx.intelligence) {
    try {
      profile.metadata = await ctx.intelligence.getMetadata('staff', staffEntityId);
    } catch (e) {
      ctx.log.warn('Failed to fetch metadata', { error: e.message });
    }

    try {
      profile.insights = await ctx.intelligence.getInsights('staff', staffEntityId);
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
