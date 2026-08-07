// Path: /home/tmax/TimSyS_v6/platform/modules/staff_profile/index.js
// Total lines: 95

'use strict';

function boot(ctx) {
  ctx.log.info('staff_profile booting', { module: 'staff_profile' });
}

function teardown(ctx) {
  ctx.log.info('staff_profile tearing down', { module: 'staff_profile' });
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
  
  var profile = {
    staff: staffResult.staff,
    certifications: [],
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
  
  if (ctx.intelligence) {
    var staffEntityId = staffResult.staff.id !== undefined ? staffResult.staff.id.toString() : (staffResult.staff.staff_id || id);
    
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

module.exports = { boot: boot, teardown: teardown, getProfile: getProfile };