'use strict';

/**
 * DecisionLog Contract — Records administrative decisions with context and rationale.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class DecisionLog {
  /**
   * Record a decision.
   * @param {string} actorId - User ID of the decision maker
   * @param {string} action - Action taken (e.g. 'student.enroll', 'room.allocate')
   * @param {object} opts - { actorName, entityType, entityId, context, rationale, outcome, relatedDecisionId }
   * @returns {number|null} - Inserted row ID or null
   */
  record(actorId, action, opts) {
    throw new Error('DecisionLog.record: not implemented');
  }

  /**
   * Get a single decision by ID.
   * @param {number} id
   * @returns {object|null}
   */
  getById(id) {
    throw new Error('DecisionLog.getById: not implemented');
  }

  /**
   * Get recent decisions, newest first.
   * @param {number} [limit=50]
   * @param {number} [offset=0]
   * @returns {object[]}
   */
  getRecent(limit, offset) {
    throw new Error('DecisionLog.getRecent: not implemented');
  }

  /**
   * Get decisions by a specific actor.
   * @param {string} actorId
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  getByActor(actorId, limit) {
    throw new Error('DecisionLog.getByActor: not implemented');
  }

  /**
   * Get decisions for a specific entity.
   * @param {string} entityType
   * @param {string} entityId
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  getByEntity(entityType, entityId, limit) {
    throw new Error('DecisionLog.getByEntity: not implemented');
  }

  /**
   * Get decisions by action type.
   * @param {string} action
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  getByAction(action, limit) {
    throw new Error('DecisionLog.getByAction: not implemented');
  }

  /**
   * Update the outcome of a decision.
   * @param {number} id - Decision ID
   * @param {string} outcome - Outcome description
   * @returns {boolean} - True if updated
   */
  updateOutcome(id, outcome) {
    throw new Error('DecisionLog.updateOutcome: not implemented');
  }

  /**
   * Get count of decisions, optionally filtered by action.
   * @param {string} [action]
   * @returns {number}
   */
  getCount(action) {
    throw new Error('DecisionLog.getCount: not implemented');
  }
}

module.exports = { DecisionLog };
