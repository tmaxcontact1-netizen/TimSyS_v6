'use strict';

const store = require('./store');
const db = require('../db');

/**
 * Insights synthesis service.
 * Aggregates metrics and generates actionable insights.
 */
class InsightsService {
  /**
   * Synthesize insights from various data sources.
   * @param {string} scope - Scope type (school, department, student, etc.)
   * @param {string} scopeId - Scope identifier
   * @param {string[]} metrics - Metrics to synthesize
   * @returns {object} Summary, metrics data, trends, alerts
   */
  async synthesize(scope, scopeId, metrics) {
    var summaryParts = [];
    var metricsData = {};
    var trends = [];
    var alerts = [];

    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      metrics = ['attendance', 'performance', 'engagement'];
    }

    // Attendance synthesis
    if (metrics.indexOf('attendance') !== -1) {
      try {
        var attendanceQuery = 'SELECT AVG(attendance_rate) as avg_rate, COUNT(*) as count FROM students WHERE school_id = ? AND attendance_rate IS NOT NULL';
        var result = db.query(attendanceQuery, [scopeId || 'all']);
        
        if (result.rows.length > 0) {
          var avgRate = parseFloat(result.rows[0].avg_rate) || 0;
          metricsData.attendance = {
            average_rate: avgRate,
            sample_size: parseInt(result.rows[0].count),
            period: 'current_term'
          };
          
          if (avgRate < 0.75) {
            alerts.push({ type: 'critical', metric: 'attendance', message: 'School-wide attendance below 75%', value: avgRate });
            summaryParts.push('Attendance at ' + (avgRate * 100).toFixed(1) + '% - intervention needed');
          } else if (avgRate < 0.85) {
            alerts.push({ type: 'warning', metric: 'attendance', message: 'Attendance below 85%', value: avgRate });
            summaryParts.push('Attendance at ' + (avgRate * 100).toFixed(1) + '% - monitor closely');
          } else {
            summaryParts.push('Attendance healthy at ' + (avgRate * 100).toFixed(1) + '%');
          }
          
          trends.push({ metric: 'attendance', value: avgRate, direction: avgRate > 0.8 ? 'stable' : 'declining' });
        }
      } catch (e) {
        // Silently continue if query fails
        metricsData.attendance = { calculated: false, error: 'Query failed' };
      }
    }

    // Performance synthesis
    if (metrics.indexOf('performance') !== -1) {
      try {
        var perfQuery = 'SELECT AVG(gpa) as avg_gpa, COUNT(CASE WHEN gpa < 2.0 THEN 1 END) as at_risk FROM students WHERE school_id = ? AND gpa IS NOT NULL';
        var perfResult = db.query(perfQuery, [scopeId || 'all']);
        
        if (perfResult.rows.length > 0) {
          var avgGpa = parseFloat(perfResult.rows[0].avg_gpa) || 0;
          var atRiskCount = parseInt(perfResult.rows[0].at_risk) || 0;
          metricsData.performance = {
            average_gpa: avgGpa,
            at_risk_students: atRiskCount,
            period: 'current_term'
          };
          
          if (avgGpa < 2.0) {
            alerts.push({ type: 'critical', metric: 'performance', message: 'School-wide GPA below 2.0', value: avgGpa });
            summaryParts.push('Academic performance at risk - average GPA ' + avgGpa.toFixed(2));
          } else {
            summaryParts.push('Average GPA ' + avgGpa.toFixed(2));
          }
          
          trends.push({ metric: 'gpa', value: avgGpa, direction: avgGpa > 2.5 ? 'positive' : 'concerning' });
        }
      } catch (e) {
        metricsData.performance = { calculated: false, error: 'Query failed' };
      }
    }

    // Engagement synthesis (placeholder - would pull from activity logs)
    if (metrics.indexOf('engagement') !== -1) {
      metricsData.engagement = {
        status: 'tracking_enabled',
        data_points: 'available_in_activity_logs'
      };
      summaryParts.push('Engagement tracking active');
    }

    if (summaryParts.length === 0) {
      summaryParts.push('No metrics available for synthesis');
    }

    return {
      summary: summaryParts.join('; '),
      metrics: metricsData,
      trends: trends,
      alerts: alerts
    };
  }

  async store(scopeType, scopeId, insightType, summary, metrics, trends, alerts, ttlHours) {
    var expiresAt = ttlHours ? Date.now() + (ttlHours * 3600 * 1000) : null;
    return store.insertInsight(scopeType, scopeId, insightType, summary, metrics, trends, alerts, expiresAt);
  }

  async get(scopeType, scopeId, insightType) {
    store.deleteOldInsights();
    return store.getInsights(scopeType, scopeId, insightType);
  }
}

var insightsService = new InsightsService();
module.exports = insightsService;
