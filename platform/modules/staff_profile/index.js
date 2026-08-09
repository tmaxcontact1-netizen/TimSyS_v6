'use strict';

var db = require('../../shared/services/db');

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
    var viewerRole = req.query.role || 'viewer';
  if (!req.query.role && req.user && req.user.permissions) {
    var perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (perms.indexOf('admin:*') !== -1) {
      viewerRole = 'developer';
    } else if (perms.some(function(p) { return p.indexOf('admin:principal') !== -1; })) {
      viewerRole = 'principal';
    } else if (perms.some(function(p) { return p.indexOf('admin:ap') !== -1 || p.indexOf('admin:assistant_principal') !== -1; })) {
      viewerRole = 'assistant_principal';
    } else if (perms.some(function(p) { return p.indexOf('admin:hod') !== -1 || p.indexOf('admin:head_of_department') !== -1; })) {
      viewerRole = 'head_of_department';
    } else if (perms.some(function(p) { return p.indexOf('admin:teacher') !== -1; })) {
      viewerRole = 'teacher';
    } else if (perms.some(function(p) { return p.indexOf('student:') !== -1; })) {
      viewerRole = 'student';
    }
  }
  var visibilityFilter = require('../../shared/services/visibilityFilter');
  
  // Check if viewer can access staff profiles
  var checkResult = visibilityFilter.checkAccess(viewerRole, 'staff');
  if (!checkResult.allowed) {
    return { success: false, statusCode: 403, error: { code: 'ACCESS_DENIED', message: 'Insufficient permissions to view staff profiles' } };
  }

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
    extended: null,
    certifications: [],
    decisions: [],
    events: [],
    metadata: null,
    insights: [],
    deep_insights: []
  };

  // Fetch extended profile
  var extResult = db.query('SELECT * FROM staff_profile_extended WHERE staff_id = ?', [staffResult.staff.id]);
  if (extResult.rows.length > 0) {
    var extRow = extResult.rows[0];
    profile.extended = {
      professional_development: typeof extRow.professional_development === 'string' ? JSON.parse(extRow.professional_development) : extRow.professional_development,
      mentorship_roles: typeof extRow.mentorship_roles === 'string' ? JSON.parse(extRow.mentorship_roles) : extRow.mentorship_roles,
      committee_memberships: typeof extRow.committee_memberships === 'string' ? JSON.parse(extRow.committee_memberships) : extRow.committee_memberships,
      performance_reviews: typeof extRow.performance_reviews === 'string' ? JSON.parse(extRow.performance_reviews) : extRow.performance_reviews,
      career_goals: extRow.career_goals,
      custom_fields: typeof extRow.custom_fields === 'string' ? JSON.parse(extRow.custom_fields) : extRow.custom_fields
    };
  }

  // Fetch related data
  var certsFunc = ctx.functionRegistry.get('staff_registry_listCertifications');
  if (certsFunc && typeof certsFunc.implementation === 'function') {
    var certsResult = await certsFunc.implementation({ params: { id: id } }, ctx);
    if (certsResult && certsResult.success) {
      profile.certifications = certsResult.certifications;
    }
  }

  if (ctx.decisionLog) {
    try {
      profile.decisions = ctx.decisionLog.getByEntity('staff', staffEntityId, 50);
    } catch (e) {
      ctx.log.warn('Failed to fetch decisions', { error: e.message });
    }
  }

  if (ctx.eventStore) {
    try {
      profile.events = ctx.eventStore.getByEntity('staff', staffEntityId, 50);
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

    // Fetch general insights
    try {
      var generalInsights = await ctx.intelligence.getInsights('staff', staffEntityId, 'general');
      profile.insights = generalInsights.map(function(insight) {
        return { ...insight, type: 'general', status: 'active' };
      });
    } catch (e) {
      ctx.log.warn('Failed to fetch general insights', { error: e.message });
    }

    // Fetch deep insights
    try {
      var deepInsights = db.query(
        "SELECT * FROM intelligence_insights WHERE scope_type = 'staff' AND scope_id = ? AND insight_level = 'deep'",
        [staffEntityId]
      );
      profile.deep_insights = deepInsights.rows.map(row => ({
        id: row.id,
        scopeType: row.scope_type,
        scopeId: row.scope_id,
        insightType: row.insight_type,
        level: row.insight_level,
        summary: row.summary,
        metricsData: typeof row.metrics_data === 'string' ? JSON.parse(row.metrics_data) : row.metrics_data,
        trendsData: typeof row.trends_data === 'string' ? JSON.parse(row.trends_data) : row.trends_data,
        alerts: typeof row.alerts === 'string' ? JSON.parse(row.alerts) : row.alerts,
        generatedAt: row.generated_at,
        expiresAt: row.expires_at,
        status: row.status,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: row.acknowledged_at,
        dismissedBy: row.dismissed_by,
        dismissedAt: row.dismissed_at,
        generatedForRole: row.generated_for_role,
        viewCount: row.view_count
      }));
    } catch (e) {
      ctx.log.warn('Failed to fetch deep insights', { error: e.message });
    }
  }

  return { success: true, profile: profile };
}

async function updateExtendedProfile(req, ctx) {
  var staffId = parseInt(req.params.id, 10);
  if (!staffId) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid staff ID required' } };
  }

  var existing = db.query('SELECT id FROM staff WHERE id = ?', [staffId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Staff not found' } };
  }

  var body = req.body || {};
  var now = new Date().toISOString();

  var checkExt = db.query('SELECT staff_id FROM staff_profile_extended WHERE staff_id = ?', [staffId]);
  if (checkExt.rows.length > 0) {
    db.query(
      "UPDATE staff_profile_extended SET professional_development = ?, mentorship_roles = ?, committee_memberships = ?, performance_reviews = ?, career_goals = ?, custom_fields = ?, updated_at = ? WHERE staff_id = ?",
      [
        JSON.stringify(body.professional_development || []),
        JSON.stringify(body.mentorship_roles || []),
        JSON.stringify(body.committee_memberships || []),
        JSON.stringify(body.performance_reviews || []),
        body.career_goals || null,
        JSON.stringify(body.custom_fields || {}),
        now,
        staffId
      ]
    );
  } else {
    db.query(
      "INSERT INTO staff_profile_extended (staff_id, professional_development, mentorship_roles, committee_memberships, performance_reviews, career_goals, custom_fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        staffId,
        JSON.stringify(body.professional_development || []),
        JSON.stringify(body.mentorship_roles || []),
        JSON.stringify(body.committee_memberships || []),
        JSON.stringify(body.performance_reviews || []),
        body.career_goals || null,
        JSON.stringify(body.custom_fields || {}),
        now,
        now
      ]
    );
  }

  var extended = db.query('SELECT * FROM staff_profile_extended WHERE staff_id = ?', [staffId]);

  if (ctx.audit) {
    ctx.audit.action('staff.profile.update', req.user.id, {
      entityType: 'staff',
      entityId: staffId,
      newValue: { extended_profile_updated: true }
    });
  }

  return { success: true, extended: extended.rows[0] };
}

async function generateDeepInsight(req, ctx) {
  var staffId = req.params.id;
  var requesterRole = req.user?.role || 'viewer';
  var requesterId = req.user?.id || 'unknown';

  var staffFunc = ctx.functionRegistry.get('staff_registry_readStaff');
  if (!staffFunc || typeof staffFunc.implementation !== 'function') {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'staff_registry not available' } };
  }

  var staffResult = await staffFunc.implementation({ params: { id: staffId } }, ctx);
  if (!staffResult.success) {
    return staffResult;
  }

  var entityId = staffResult.staff.id !== undefined ? staffResult.staff.id.toString() : staffId;

  var data = {
    staff: staffResult.staff,
    metadata: null,
    decisions: [],
    events: [],
    alerts: [],
    flags: [],
    summary_parts: []
  };

  if (ctx.intelligence) {
    try {
      data.metadata = await ctx.intelligence.getMetadata('staff', entityId);
      if (data.metadata && data.metadata.tags) {
        data.flags = data.metadata.tags.filter(function(t) { return t.indexOf('_risk') > -1 || t.indexOf('_alert') > -1; });
      }
    } catch (e) {}
  }

  if (ctx.decisionLog) {
    try {
      data.decisions = ctx.decisionLog.getByEntity('staff', entityId, 20);
    } catch (e) {}
  }

  if (ctx.eventStore) {
    try {
      data.events = ctx.eventStore.getByEntity('staff', entityId, 20);
    } catch (e) {}
  }

  var insightBody = {
    entityType: 'staff',
    entityId: entityId,
    employment_status: staffResult.staff.employment_status,
    employment_type: staffResult.staff.employment_type,
    department: staffResult.staff.department,
    job_title: staffResult.staff.job_title,
    dbs_status: staffResult.staff.dbs_check_status,
    dbs_expiry: staffResult.staff.dbs_expiry_date,
    flags: data.flags,
    decisions_count: data.decisions.length,
    events_count: data.events.length
  };

  var summary = 'Staff profile analysis: ' +
    'Employment: ' + staffResult.staff.employment_type + ' (' + staffResult.staff.employment_status + '). ' +
    (staffResult.staff.department ? 'Department: ' + staffResult.staff.department + '. ' : '') +
    (data.flags.length > 0 ? data.flags.length + ' flags detected. ' : '');

  var alerts = [];
  if (staffResult.staff.dbs_check_status === 'expired') {
    alerts.push({ type: 'critical', title: 'DBS Expired', description: 'Background check has expired' });
  } else if (staffResult.staff.dbs_check_status === 'disclosed') {
    alerts.push({ type: 'warning', title: 'DBS Disclosure', description: 'DBS check has disclosed information requiring review' });
  }
  if (staffResult.staff.dbs_expiry_date) {
    var expiry = new Date(staffResult.staff.dbs_expiry_date);
    var daysUntilExpiry = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry > 0 && daysUntilExpiry < 60) {
      alerts.push({ type: 'warning', title: 'DBS Expiring Soon', description: 'Expires in ' + daysUntilExpiry + ' days' });
    }
  }

  var insightId = await ctx.intelligence.storeInsight(
    'staff',
    entityId,
    'deep',
    summary,
    insightBody,
    [],
    alerts,
    null
  );

  db.query(
    "UPDATE intelligence_insights SET insight_level = 'deep', generated_for_role = ? WHERE id = ?",
    [requesterRole, insightId]
  );

  db.query(
    "INSERT INTO insight_visibility_log (insight_id, viewer_role, viewer_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'generated', ?, ?)",
    [insightId, requesterRole, requesterId, 'staff', entityId]
  );

  if (ctx.audit) {
    ctx.audit.action('staff.insight.generate', req.user.id, {
      entityType: 'staff',
      entityId: entityId,
      insightId: insightId,
      forRole: requesterRole
    });
  }

  return { success: true, insightId: insightId };
}

async function acknowledgeInsight(req, ctx) {
  var insightId = req.params.insightId;
  var userId = req.user?.id || 'unknown';
  var userRole = req.user?.role || 'viewer';

  var existing = db.query('SELECT * FROM intelligence_insights WHERE id = ?', [insightId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Insight not found' } };
  }

  db.query(
    "UPDATE intelligence_insights SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = strftime('%s', 'now') * 1000, updated_at = datetime('now') WHERE id = ?",
    [userId, insightId]
  );

  db.query(
    "INSERT INTO insight_visibility_log (insight_id, viewer_role, viewer_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'acknowledged', ?, ?)",
    [insightId, userRole, userId, existing.rows[0].entity_type, existing.rows[0].entity_id]
  );

  return { success: true };
}

async function dismissInsight(req, ctx) {
  var insightId = req.params.insightId;
  var userId = req.user?.id || 'unknown';
  var userRole = req.user?.role || 'viewer';

  var existing = db.query('SELECT * FROM intelligence_insights WHERE id = ?', [insightId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Insight not found' } };
  }

  db.query(
    "UPDATE intelligence_insights SET status = 'dismissed', dismissed_by = ?, dismissed_at = strftime('%s', 'now') * 1000, updated_at = datetime('now') WHERE id = ?",
    [userId, insightId]
  );

  db.query(
    "INSERT INTO insight_visibility_log (insight_id, viewer_role, viewer_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'dismissed', ?, ?)",
    [insightId, userRole, userId, existing.rows[0].entity_type, existing.rows[0].entity_id]
  );

  return { success: true };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  listProfiles: listProfiles,
  getProfile: getProfile,
  updateExtendedProfile: updateExtendedProfile,
  generateDeepInsight: generateDeepInsight,
  acknowledgeInsight: acknowledgeInsight,
  dismissInsight: dismissInsight
};
