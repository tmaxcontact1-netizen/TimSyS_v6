'use strict';

const store = require('./store');

/**
 * Metadata catalog service.
 * Detects patterns and classifies entities based on their attributes.
 */
class MetadataService {
  /**
   * Suggest metadata tags and classifications based on entity data.
   * @param {string} entityType - Type of entity (student, teacher, course, etc.)
   * @param {string} entityId - Unique identifier
   * @param {object} data - Entity attributes
   * @returns {object} Suggested tags, classifications, confidence score
   */
  async suggest(entityType, entityId, data) {
    const tags = [];
    const classifications = [];

    if (!data || typeof data !== 'object') {
      return { tags, classifications, confidence: 0 };
    }

    // Contact information detection
    if (data.email) {
      tags.push('contact_email');
      if (typeof data.email === 'string' && data.email.includes('@')) {
        var domain = data.email.split('@')[1];
        if (domain) {
          if (domain.includes('.edu')) tags.push('education_domain');
          if (domain.includes('.gov')) tags.push('government_domain');
          tags.push('email_verified_format');
        }
      }
    }
    if (data.phone) tags.push('contact_phone');
    if (data.address) tags.push('address_on_file');

    // Student-specific classification
    if (entityType === 'student' || data.role === 'student') {
      classifications.push('learner');
      if (data.enrollment_status) {
        if (data.enrollment_status === 'active') tags.push('enrolled_active');
        if (data.enrollment_status === 'inactive') tags.push('enrollment_suspended');
      }
      if (data.grade_level) {
        var level = data.grade_level;
        if (level >= 9 && level <= 12) classifications.push('high_school');
        if (level >= 13 && level <= 16) classifications.push('college');
        if (level >= 0 && level < 9) classifications.push('elementary_middle');
      }
      if (data.gpa !== undefined) tags.push('has_gpa');
      if (data.attendance_rate !== undefined) tags.push('attendance_tracked');
    }

    // Teacher-specific classification
    if (entityType === 'teacher' || data.role === 'teacher') {
      classifications.push('educator');
      if (data.department) tags.push('department_assigned');
      if (data.courses_taught) tags.push('courses_assigned');
      if (data.certification) tags.push('certified');
    }

    // Course-specific classification
    if (entityType === 'course' || data.type === 'course') {
      classifications.push('curriculum');
      if (data.credit_hours) tags.push('credit_course');
      if (data.prerequisites) tags.push('has_prerequisites');
      if (data.enrollment_count) tags.push('enrollment_tracked');
    }

    // Risk indicators
    if (data.attendance_rate !== undefined && data.attendance_rate < 0.75) {
      tags.push('attendance_concern');
      classifications.push('at_risk');
    }
    if (data.gpa !== undefined && data.gpa < 2.0) {
      tags.push('academic_struggle');
      classifications.push('academic_risk');
    }

    var confidence = tags.length > 5 ? 0.95 : tags.length > 2 ? 0.85 : 0.70;
    if (tags.length === 0) confidence = 0.5;

    return { tags, classifications, confidence };
  }

  async get(entityType, entityId) {
    return store.getMetadata(entityType, entityId);
  }

  async store(entityType, entityId, data) {
    var suggestion = await this.suggest(entityType, entityId, data);
    return store.upsertMetadata(entityType, entityId, suggestion, data);
  }
}

var metadataService = new MetadataService();
module.exports = metadataService;
