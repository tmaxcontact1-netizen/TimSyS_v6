'use strict';

const TEACHING_GROUP_KINDS = Object.freeze([
  'academic', 'homeroom', 'advisory', 'club', 'support', 'other'
]);
const GRADEBOOK_MODES = Object.freeze([
  'graded', 'standards_only', 'narrative_only', 'evidence_only', 'dormant'
]);
const EVIDENCE_STATES = Object.freeze([
  'recorded', 'missing', 'incomplete', 'exempt', 'absent', 'late', 'not_assessed', 'invalid'
]);
const TEACHING_GROUP_EVENTS = Object.freeze([
  'teaching_group.created',
  'teaching_group.updated',
  'teaching_group.teacher_assigned',
  'teaching_group.teacher_unassigned',
  'teaching_group.student_enrolled',
  'teaching_group.student_withdrawn',
  'teaching_group.closed'
]);

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(field + ' is required');
}

function validateTeachingGroup(value) {
  if (!value || typeof value !== 'object') throw new Error('teaching group is required');
  requiredString(value.external_key, 'external_key');
  requiredString(value.academic_year_id, 'academic_year_id');
  requiredString(value.name, 'name');
  if (!TEACHING_GROUP_KINDS.includes(value.kind)) throw new Error('unsupported teaching group kind');
  if (value.subject_id != null) requiredString(value.subject_id, 'subject_id');
  if (value.status != null && !['active', 'closed', 'withdrawn'].includes(value.status)) throw new Error('unsupported teaching group status');
  return value;
}

function validateTeachingGroupEvent(channel, payload) {
  if (!TEACHING_GROUP_EVENTS.includes(channel)) throw new Error('unsupported teaching group event');
  if (!payload || typeof payload !== 'object') throw new Error('event payload is required');
  requiredString(payload.event_id, 'event_id');
  requiredString(payload.occurred_at, 'occurred_at');
  requiredString(payload.source, 'source');
  requiredString(payload.teaching_group_external_key, 'teaching_group_external_key');
  if (channel === 'teaching_group.created' || channel === 'teaching_group.updated') validateTeachingGroup(payload.teaching_group);
  return payload;
}

function gradebookIdentity(teachingGroup) {
  validateTeachingGroup(teachingGroup);
  return [teachingGroup.academic_year_id, teachingGroup.external_key, teachingGroup.subject_id || 'non_subject'].join(':');
}

function resolveReportingPeriodConfiguration(config) {
  config = config || {};
  return config.gradebook || config.course || config.programme || config.school || null;
}

module.exports = {
  TEACHING_GROUP_KINDS,
  GRADEBOOK_MODES,
  EVIDENCE_STATES,
  TEACHING_GROUP_EVENTS,
  validateTeachingGroup,
  validateTeachingGroupEvent,
  gradebookIdentity,
  resolveReportingPeriodConfiguration
};
