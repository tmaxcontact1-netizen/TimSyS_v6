// Path: /home/tmax/TimSyS_v6/platform/shared/services/intelligence/insights.js
// Total lines: 182

'use strict';

const store = require('./store');
const metadataService = require('./metadata');
const logicService = require('./logic');

/**
 * Insights synthesis service.
 * Consumes data from functionRegistry, metadata, and rules.
 * The engine pulls — it never expects modules to push.
 */
class InsightsService {
  /**
   * Synthesize insights by discovering and consuming all registered data sources.
   * @param {object} options - Optional configuration
   * @param {string[]} options.entityTypes - Limit to specific entity types (default: all)
   * @param {number} options.limit - Max entities per source (default: 500)
   * @returns {object} Summary, metrics, trends, alerts
   */
  async synthesize(options) {
    var opts = options || {};
    var entityFilter = opts.entityTypes || null;
    var limit = opts.limit || 500;

    var summaryParts = [];
    var metricsData = {};
    var trends = [];
    var alerts = [];

    // --- 1. Discover data sources via functionRegistry ---
    var functionRegistry;
    try {
      functionRegistry = require('../../registry/functionRegistry');
    } catch (e) {
      summaryParts.push('Function registry unavailable');
      return {
        summary: summaryParts.join('; '),
        metrics: metricsData,
        trends: trends,
        alerts: [{ type: 'system', message: 'Function registry not accessible' }]
      };
    }

    var allFunctions = functionRegistry.getAll();
    var listFunctions = allFunctions.filter(function (fn) {
      return fn.name.indexOf('_list') !== -1;
    });

    if (listFunctions.length === 0) {
      summaryParts.push('No data sources registered');
      return {
        summary: summaryParts.join('; '),
        metrics: metricsData,
        trends: trends,
        alerts: []
      };
    }

    // Entity type mapping: module:bareFunctionName to canonical entity type
    var entityTypeMapping = {
      'student_registry:listStudents': 'student',
      'staff_registry:listStaff': 'staff',
      'room_registry:listRooms': 'room',
      'inventory:listItems': 'item',
      'student_registry:listContacts': 'contact',
      'staff_registry:listCertifications': 'certification',
      'room_registry:listBookings': 'booking',
      'inventory:listCheckouts': 'checkout',
      'user_management:listUsers': 'user',
      'system_health:listStagedModules': 'module'
    };

    // --- 2. Pull data from each source ---
    var allEntities = [];
    var sourceCounts = {};

    for (var i = 0; i < listFunctions.length; i++) {
      var fn = listFunctions[i];
      var moduleName = fn.moduleName;
      var funcName = fn.name;

      // Strip module prefix from function name to get the bare function name
      var bareFuncName = funcName;
      if (moduleName && funcName.indexOf(moduleName + '_') === 0) {
        bareFuncName = funcName.slice(moduleName.length + 1);
      }

      // Derive entity type from mapping or function name
      var lookupKey = moduleName + ':' + bareFuncName;
      var entityType = entityTypeMapping[lookupKey];

      if (!entityType) {
        // Fall back: bareFuncName is e.g. "listStudents" -> "student"
        var baseName = bareFuncName.replace(/^list/, '');
        entityType = baseName.charAt(0).toLowerCase() + baseName.slice(1);
        entityType = entityType.replace(/s$/, '');
      }

      // Skip functions that don't map to a valid entity type
      if (!entityType || entityType.trim() === '') continue;

      if (entityFilter && entityFilter.indexOf(entityType) === -1) continue;

      var ref = functionRegistry.get(fn.name);
      if (!ref || typeof ref.implementation !== 'function') continue;

      try {
        var mockReq = { query: { limit: limit, page: 1 }, params: {}, body: {} };
        var mockCtx = this._buildMockCtx();
        var result = await ref.implementation(mockReq, mockCtx);

        var rows = [];
        if (result && result.success) {
          var collectionKey = Object.keys(result).filter(function (k) {
            return k !== 'success' && k !== 'total' && k !== 'page' && k !== 'limit' && Array.isArray(result[k]);
          })[0];
          if (collectionKey) {
            rows = result[collectionKey];
          }
        }

        sourceCounts[entityType] = rows.length;
        metricsData[entityType] = {
          count: rows.length,
          source: fn.module
        };

        for (var j = 0; j < rows.length; j++) {
          rows[j]._entityType = entityType;
          rows[j]._sourceModule = fn.module;
          allEntities.push(rows[j]);
        }
      } catch (e) {
        metricsData[entityType] = { count: 0, error: e.message };
      }
    }

    // --- 3. Pull metadata for each entity ---
    var metadataCount = 0;
    var tagFrequency = {};
    var classificationFrequency = {};

    for (var k = 0; k < allEntities.length; k++) {
      var entity = allEntities[k];
      var entityType = entity._entityType;
      var entityId = entity.id !== undefined ? entity.id.toString() : (entity.student_id || entity.item_number || entity.room_number || entity.staff_id || entity.user_id || 'unknown');

      try {
        var meta = await metadataService.get(entityType, entityId);
        if (meta) {
          metadataCount++;
          entity._metadata = meta;
          if (meta.tags) {
            for (var t = 0; t < meta.tags.length; t++) {
              tagFrequency[meta.tags[t]] = (tagFrequency[meta.tags[t]] || 0) + 1;
            }
          }
          if (meta.classifications) {
            for (var c = 0; c < meta.classifications.length; c++) {
              classificationFrequency[meta.classifications[c]] = (classificationFrequency[meta.classifications[c]] || 0) + 1;
            }
          }
        }
      } catch (e) {
        // metadata not critical, continue
      }
    }

    metricsData.metadata = {
      entities_with_metadata: metadataCount,
      total_entities: allEntities.length,
      coverage: allEntities.length > 0 ? (metadataCount / allEntities.length) : 0,
      tag_frequency: tagFrequency,
      classification_frequency: classificationFrequency
    };

    // --- 4. Evaluate all rules against combined context ---
    var allRules = await store.getRules(true); // enabled only
    var ruleIds = allRules.map(function (r) { return r.id; });

    var combinedContext = {
      entities: allEntities,
      source_counts: sourceCounts,
      tag_frequency: tagFrequency,
      classification_frequency: classificationFrequency,
      total_entities: allEntities.length
    };

    var logicResult = { matchedRules: [], triggers: [], score: 0 };
    if (ruleIds.length > 0) {
      try {
        logicResult = await logicService.evaluate(ruleIds, combinedContext);
      } catch (e) {
        // rules not critical, continue
      }
    }

    metricsData.rules = {
      total_rules: allRules.length,
      matched: logicResult.matchedRules.length,
      triggers: logicResult.triggers.length,
      risk_score: logicResult.score
    };

    // --- 5. Generate alerts from triggers ---
    for (var a = 0; a < logicResult.triggers.length; a++) {
      var trigger = logicResult.triggers[a];
      var rule = allRules.find(function (r) { return r.id === trigger.ruleId; });
      var ruleName = rule ? rule.name : trigger.ruleId;
      var alertType = 'warning';
      if (rule && rule.priority >= 10) alertType = 'critical';

      alerts.push({
        type: alertType,
        ruleId: trigger.ruleId,
        ruleName: ruleName,
        actions: trigger.actions
      });
    }

    // --- 6. Build summary ---
    var sourceNames = Object.keys(sourceCounts);
    for (var s = 0; s < sourceNames.length; s++) {
      var name = sourceNames[s];
      summaryParts.push(name + ': ' + sourceCounts[name] + ' entities');
    }

    if (metadataCount > 0) {
      summaryParts.push('metadata coverage: ' + ((metadataCount / allEntities.length) * 100).toFixed(0) + '%');
    }

    if (logicResult.matchedRules.length > 0) {
      summaryParts.push(logicResult.matchedRules.length + ' rule(s) triggered');
    } else if (allRules.length > 0) {
      summaryParts.push(allRules.length + ' rule(s) evaluated, none triggered');
    }

    if (summaryParts.length === 0) {
      summaryParts.push('No data available for synthesis');
    }

    // --- 7. Build trends ---
    for (var tn = 0; tn < sourceNames.length; tn++) {
      var srcName = sourceNames[tn];
      trends.push({
        metric: srcName + '_count',
        value: sourceCounts[srcName],
        direction: 'stable'
      });
    }

    return {
      summary: summaryParts.join('; '),
      metrics: metricsData,
      trends: trends,
      alerts: alerts
    };
  }

  /**
   * Build a minimal mock context for calling registry functions.
   * Functions expect { req, ctx } where ctx has db, log, events, etc.
   */
  _buildMockCtx() {
    var db = require('../db');
    var log = require('../log');
    var events = require('../events');
    var cache = require('../cache');
    var auth = require('../auth');
    var validate = require('../validate');

    return {
      db: db,
      log: log,
      events: events,
      cache: cache,
      auth: auth,
      validate: validate,
      query: function () { return db.query.apply(db, arguments); }
    };
  }

  async storeInsight(scopeType, scopeId, insightType, summary, metrics, trends, alerts, ttlHours) {
    var expiresAt = ttlHours ? Date.now() + (ttlHours * 3600 * 1000) : null;
    return store.insertInsight(scopeType, scopeId, insightType, summary, metrics, trends, alerts, expiresAt);
  }

  async getInsights(scopeType, scopeId, insightType) {
    store.deleteOldInsights();
    return store.getInsights(scopeType, scopeId, insightType);
  }
}

var insightsService = new InsightsService();
module.exports = insightsService;