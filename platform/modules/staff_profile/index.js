// Path: /home/tmax/TimSyS_v6/platform/modules/staff_profile/index.js
// Total lines: ~85

'use strict';

const functionRegistry = require('../../shared/registry/functionRegistry');

function boot(ctx) {
  ctx.log.info('staff_profile booting', { module: 'staff_profile' });
}

function teardown(ctx) {
  ctx.log.info('staff_profile tearing down', { module: 'staff_profile' });
}

async function getProfile(req, ctx) {
  var id = req.params.id;

  var subReq = { params: { id: id }, query: {}, body: {}, user: req.user };

  var staffFn = functionRegistry.get('staff_registry_readStaff');
  if (!staffFn) {
    return { success: false, statusCode: 500, error: { code: 'DEPENDENCY_MISSING', message: 'staff_registry_readStaff not available' } };
  }
  var staffResult = await staffFn.implementation(subReq, ctx);
  if (!staffResult.success) {
    return staffResult;
  }

  var certsFn = functionRegistry.get('staff_registry_listCertifications');
  var certsResult = null;
  if (certsFn) {
    certsResult = await certsFn.implementation(subReq, ctx);
  }

  var profile = {
    staff: staffResult.staff,
    certifications: certsResult && certsResult.success ? certsResult.certifications : []
  };

  if (ctx.audit) {
    ctx.audit.action('staff_profile.view', req.user.id, {
      entityType: 'staff',
      entityId: staffResult.staff.id
    });
  }

  return { success: true, profile: profile };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  getProfile: getProfile
};