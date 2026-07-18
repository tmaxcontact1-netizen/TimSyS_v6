'use strict';

const store = require('./store');

/**
 * Insights synthesis service.
 */
class InsightsService {
  async synthesize(scope, scopeId, metrics) {
    // Placeholder: implement aggregation/synthesis logic
    // This would typically query other modules' data via EventBus or direct DB access
    const summary = 'Insights synthesized for ' + scope + ': ' + scopeId;
    const metricsData = {};
    const trends = [];
    const alerts = [];

    // Example: derive summary from requested metrics
    if (metrics && metrics.includes('attendance')) {
      metricsData.attendance = { calculated: true };
      alerts.push('Attendance trend requires further analysis');
    }

    return {
      summary,
      metrics: metricsData,
      trends,
      alerts,
    };
  }

  async store(scopeType, scopeId, insightType, summary, metrics, trends, alerts, ttlHours) {
    const expiresAt = ttlHours ? Date.now() + (ttlHours * 3600 * 1000) : null;
    return store.insertInsight(scopeType, scopeId, insightType, summary, metrics, trends, alerts, expiresAt);
  }

  async get(scopeType, scopeId, insightType) {
    store.deleteOldInsights();
    return store.getInsights(scopeType, scopeId, insightType);
  }
}

const insightsService = new InsightsService();
module.exports = insightsService;