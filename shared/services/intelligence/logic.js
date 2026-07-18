'use strict';

const store = require('./store');

/**
 * Logic rule evaluation service.
 */
class LogicService {
  async evaluate(ruleIds, context) {
    const matchedRules = [];
    const triggers = [];
    let score = 0;

    for (const ruleId of ruleIds) {
      const rule = await store.getRule(ruleId);
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

  _matchesConditions(conditions, context) {
    // Placeholder: implement condition evaluation logic
    // Would parse conditions like: { field: 'attendance_rate', operator: '<', value: 0.75 }
    // and evaluate against context object
    if (!conditions || Object.keys(conditions).length === 0) return true;
    return true; // Simplified for now
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

const logicService = new LogicService();
module.exports = logicService;