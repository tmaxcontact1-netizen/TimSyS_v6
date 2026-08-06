'use strict';

const store = require('./store');

/**
 * Logic rule evaluation service.
 * Evaluates rules against context and triggers actions.
 */
class LogicService {
  /**
   * Evaluate rules against context data.
   * @param {string[]} ruleIds - Rule IDs to evaluate
   * @param {object} context - Context data for evaluation
   * @returns {object} Matched rules, triggers, score
   */
  async evaluate(ruleIds, context) {
    var matchedRules = [];
    var triggers = [];
    var score = 0;

    if (!ruleIds || !Array.isArray(ruleIds)) {
      return { matchedRules, triggers, score: 0 };
    }

    for (var i = 0; i < ruleIds.length; i++) {
      var ruleId = ruleIds[i];
      var rule = await store.getRule(ruleId);
      
      if (!rule || !rule.enabled) continue;

      if (this._matchesConditions(rule.conditions, context)) {
        matchedRules.push(ruleId);
        triggers.push({ ruleId, actions: rule.actions });
        score += rule.priority;
        await store.updateRuleLastTriggered(ruleId);
      }
    }

    return { matchedRules, triggers, score };
  }

  /**
   * Evaluate conditions against context.
   * Supports operators: ==, !=, <, >, <=, >=, contains, in, not_in, exists
   * @param {object} conditions - Conditions object
   * @param {object} context - Context to evaluate against
   * @returns {boolean} True if all conditions match
   */
  _matchesConditions(conditions, context) {
    if (!conditions || Object.keys(conditions).length === 0) return true;
    if (!context || typeof context !== 'object') return false;

    var conditionKeys = Object.keys(conditions);
    
    for (var i = 0; i < conditionKeys.length; i++) {
      var field = conditionKeys[i];
      var condition = conditions[field];
      var contextValue = this._getFieldValue(context, field);

      // Handle simple value comparison
      if (typeof condition !== 'object') {
        if (contextValue !== condition) return false;
        continue;
      }

      // Handle operator-based conditions
      var operator = condition.operator || '==';
      var compareValue = condition.value;

      switch (operator) {
        case '==':
        case '=':
        case 'eq':
          if (contextValue !== compareValue) return false;
          break;

        case '!=':
        case '<>':
        case 'ne':
        case 'not_eq':
          if (contextValue === compareValue) return false;
          break;

        case '<':
        case 'lt':
          if (typeof contextValue !== 'number' || contextValue >= compareValue) return false;
          break;

        case '>':
        case 'gt':
          if (typeof contextValue !== 'number' || contextValue <= compareValue) return false;
          break;

        case '<=':
        case 'lte':
          if (typeof contextValue !== 'number' || contextValue > compareValue) return false;
          break;

        case '>=':
        case 'gte':
          if (typeof contextValue !== 'number' || contextValue < compareValue) return false;
          break;

        case 'contains':
          if (typeof contextValue !== 'string' || contextValue.indexOf(compareValue) === -1) return false;
          break;

        case 'in':
          if (!Array.isArray(compareValue) || compareValue.indexOf(contextValue) === -1) return false;
          break;

        case 'not_in':
          if (!Array.isArray(compareValue) || compareValue.indexOf(contextValue) !== -1) return false;
          break;

        case 'exists':
          if (contextValue === undefined || contextValue === null) return false;
          break;

        case 'not_exists':
          if (contextValue !== undefined && contextValue !== null) return false;
          break;

        default:
          // Unknown operator - fail safely
          return false;
      }
    }

    return true;
  }

  /**
   * Get nested field value from context object.
   * Supports dot notation: "profile.email"
   * @param {object} obj - Context object
   * @param {string} path - Field path
   * @returns {*} Value or undefined
   */
  _getFieldValue(obj, path) {
    if (!path) return undefined;
    
    var parts = path.split('.');
    var current = obj;
    
    for (var i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return undefined;
      current = current[parts[i]];
    }
    
    return current;
  }

  async register(name, description, conditions, actions, priority) {
    return store.insertRule(name, description, conditions, actions, priority);
  }

  async delete(ruleId) {
    return store.deleteRule(ruleId);
  }

  async list(enabledOnly) {
    return store.getRules(enabledOnly);
  }
}

var logicService = new LogicService();
module.exports = logicService;
