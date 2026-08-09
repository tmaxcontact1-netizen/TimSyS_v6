'use strict';

var db = require('../../shared/services/db');

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
  var viewerRole = req.query.role || req.user.role || 'viewer';

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
    extended: null,
    contacts: [],
    enrollment_history: [],
    decisions: [],
    events: [],
    metadata: null,
    insights: [],
    deep_insights: []
  };

  // Fetch extended profile
  var extResult = db.query('SELECT * FROM student_profile_extended WHERE student_id = ?', [studentResult.student.id]);
  if (extResult.rows.length > 0) {
    var extRow = extResult.rows[0];
    profile.extended = {
      interests: typeof extRow.interests === 'string' ? JSON.parse(extRow.interests) : extRow.interests,
      strengths: typeof extRow.strengths === 'string' ? JSON.parse(extRow.strengths) : extRow.strengths,
      goals: typeof extRow.goals === 'string' ? JSON.parse(extRow.goals) : extRow.goals,
      extracurricular: typeof extRow.extracurricular === 'string' ? JSON.parse(extRow.extracurricular) : extRow.extracurricular,
      medical_details: extRow.medical_details,
      dietary_requirements: extRow.dietary_requirements,
      transport_info: extRow.transport_info,
      parent_conference_notes: extRow.parent_conference_notes,
      custom_fields: typeof extRow.custom_fields === 'string' ? JSON.parse(extRow.custom_fields) : extRow.custom_fields
    };
  }

  // Fetch related data
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
      profile.decisions = ctx.decisionLog.getByEntity('student', studentEntityId, 50);
    } catch (e) {
      ctx.log.warn('Failed to fetch decisions', { error: e.message });
    }
  }

  if (ctx.eventStore) {
    try {
      profile.events = ctx.eventStore.getByEntity('student', studentEntityId, 50);
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

    // Fetch general insights (auto-generated)
    try {
      var generalInsights = await ctx.intelligence.getInsights('student', studentEntityId, 'general');
      profile.insights = generalInsights.map(function(insight) {
        return { ...insight, type: 'general', status: 'active' };
      });
    } catch (e) {
      ctx.log.warn('Failed to fetch general insights', { error: e.message });
    }

    // Fetch deep insights (user-generated) with visibility filtering
    try {
      var deepInsights = db.query(
        "SELECT * FROM intelligence_insights WHERE scope_type = 'student' AND scope_id = ? AND insight_level = 'deep'",
        [studentEntityId]
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
  var studentId = parseInt(req.params.id, 10);
  if (!studentId) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid student ID required' } };
  }

  var existing = db.query('SELECT id FROM students WHERE id = ?', [studentId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Student not found' } };
  }

  var body = req.body || {};
  var now = new Date().toISOString();

  // Upsert extended profile
  var checkExt = db.query('SELECT student_id FROM student_profile_extended WHERE student_id = ?', [studentId]);
  if (checkExt.rows.length > 0) {
    db.query(
      "UPDATE student_profile_extended SET interests = ?, strengths = ?, goals = ?, extracurricular = ?, medical_details = ?, dietary_requirements = ?, transport_info = ?, parent_conference_notes = ?, custom_fields = ?, updated_at = ? WHERE student_id = ?",
      [
        JSON.stringify(body.interests || {}),
        JSON.stringify(body.strengths || {}),
        JSON.stringify(body.goals || {}),
        JSON.stringify(body.extracurricular || []),
        body.medical_details || null,
        body.dietary_requirements || null,
        body.transport_info || null,
        body.parent_conference_notes || null,
        JSON.stringify(body.custom_fields || {}),
        now,
        studentId
      ]
    );
  } else {
    db.query(
      "INSERT INTO student_profile_extended (student_id, interests, strengths, goals, extracurricular, medical_details, dietary_requirements, transport_info, parent_conference_notes, custom_fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        studentId,
        JSON.stringify(body.interests || {}),
        JSON.stringify(body.strengths || {}),
        JSON.stringify(body.goals || {}),
        JSON.stringify(body.extracurricular || []),
        body.medical_details || null,
        body.dietary_requirements || null,
        body.transport_info || null,
        body.parent_conference_notes || null,
        JSON.stringify(body.custom_fields || {}),
        now,
        now
      ]
    );
  }

  var extended = db.query('SELECT * FROM student_profile_extended WHERE student_id = ?', [studentId]);
  var extendedData = extended.rows[0];

  if (ctx.audit) {
    ctx.audit.action('student.profile.update', req.user.id, {
      entityType: 'student',
      entityId: studentId,
      newValue: { extended_profile_updated: true }
    });
  }

  return { success: true, extended: extendedData };
}

async function generateDeepInsight(req, ctx) {
  var studentId = req.params.id;
  var requesterRole = req.user?.role || 'viewer';
  var requesterId = req.user?.id || 'unknown';

  var studentFunc = ctx.functionRegistry.get('student_registry_readStudent');
  if (!studentFunc || typeof studentFunc.implementation !== 'function') {
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'student_registry not available' } };
  }

  var studentResult = await studentFunc.implementation({ params: { id: studentId } }, ctx);
  if (!studentResult.success) {
    return studentResult;
  }

  var entityId = studentResult.student.id !== undefined ? studentResult.student.id.toString() : studentId;

  // Aggregate all data sources
  var data = {
    student: studentResult.student,
    metadata: null,
    decisions: [],
    events: [],
    alerts: [],
    flags: [],
    summary_parts: []
  };

  if (ctx.intelligence) {
    try {
      data.metadata = await ctx.intelligence.getMetadata('student', entityId);
      if (data.metadata && data.metadata.tags) {
        data.flags = data.metadata.tags.filter(function(t) { return t.indexOf('_risk') > -1 || t.indexOf('_alert') > -1; });
      }
    } catch (e) {}
  }

  if (ctx.decisionLog) {
    try {
      data.decisions = ctx.decisionLog.getByEntity('student', entityId, 20);
    } catch (e) {}
  }

  if (ctx.eventStore) {
    try {
      data.events = ctx.eventStore.getByEntity('student', entityId, 20);
    } catch (e) {}
  }

  // Build deep insight
  var insightBody = {
    entityType: 'student',
    entityId: entityId,
    enrollment: studentResult.student.enrollment_status,
    grade: studentResult.student.current_grade_level,
    flags: data.flags,
    decisions_count: data.decisions.length,
    events_count: data.events.length,
    medical_alert: studentResult.student.medical_alert_flag,
    special_ed: studentResult.student.special_education_flag,
    gifted: studentResult.student.gifted_talented_flag,
    esl: studentResult.student.esl_flag
  };

  var summary = 'Student profile analysis: ' + 
    (data.flags.length > 0 ? data.flags.length + ' risk flags detected. ' : '') +
    (studentResult.student.medical_alert_flag ? 'Medical alert active. ' : '') +
    'Total decisions: ' + data.decisions.length + ', events: ' + data.events.length + '. ';

  var alerts = [];
  if (studentResult.student.medical_alert_flag) {
    alerts.push({ type: 'critical', title: 'Medical Alert Active', description: studentResult.student.medical_details || 'See medical details' });
  }
  if (data.flags.some(f => f === 'attendance_concern')) {
    alerts.push({ type: 'warning', title: 'Attendance Concern', description: 'Student has flagged attendance issues' });
  }

  // Store insight
  var insightId = await ctx.intelligence.storeInsight(
    'student',
    entityId,
    'deep',
    summary,
    insightBody,
    [],
    alerts,
    null
  );

  // Update with level and metadata
  db.query(
    "UPDATE intelligence_insights SET insight_level = 'deep', generated_for_role = ? WHERE id = ?",
    [requesterRole, insightId]
  );

  // Log generation
  db.query(
    "INSERT INTO insight_visibility_log (insight_id, viewer_role, viewer_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'generated', ?, ?)",
    [insightId, requesterRole, requesterId, 'student', entityId]
  );

  if (ctx.audit) {
    ctx.audit.action('student.insight.generate', req.user.id, {
      entityType: 'student',
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

  if (ctx.audit) {
    ctx.audit.action('insight.acknowledge', userId, {
      entityType: 'insight',
      entityId: insightId
    });
  }

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
