'use strict';

var db = require('../../services/db');

var hierarchyCache = null;
var cacheTimeout = 300000;
var lastRefresh = 0;

function refreshHierarchy() {
  var now = Date.now();
  if (now - lastRefresh < cacheTimeout && hierarchyCache) {
    return hierarchyCache;
  }

  var result = db.query('SELECT * FROM role_hierarchy ORDER BY hierarchy_level ASC');
  var hierarchy = {};

  result.rows.forEach(function(row) {
    var canSee = [];
    try {
      canSee = row.can_see_roles ? JSON.parse(row.can_see_roles) : [];
    } catch (e) {
      canSee = [];
    }
    hierarchy[row.role_name] = {
      level: row.hierarchy_level,
      canSee: canSee,
      description: row.description
    };
  });

  hierarchyCache = hierarchy;
  lastRefresh = now;

  return hierarchy;
}

function getViewerLevel(viewerRole) {
  var hierarchy = refreshHierarchy();
  var viewerData = hierarchy[viewerRole];
  if (!viewerData) {
    return null;
  }
  return viewerData.level;
}

function canSeeRole(viewerRole, targetRole) {
  var hierarchy = refreshHierarchy();
  var viewerData = hierarchy[viewerRole];
  if (!viewerData) {
    return false;
  }
  return viewerData.canSee.indexOf(targetRole) !== -1;
}

function canSeeTier(viewerRole, targetTier) {
  var viewerLevel = getViewerLevel(viewerRole);
  if (viewerLevel === null) {
    return false;
  }
  return viewerLevel >= targetTier;
}

function checkAccess(viewerRole, entityType, targetTier) {
  var viewerLevel = getViewerLevel(viewerRole);
  if (viewerLevel === null) {
    return { allowed: false, reason: 'Unknown viewer role', viewerLevel: null, targetTier: targetTier };
  }

  var effectiveTargetTier = targetTier || getDefaultEntityTier(entityType);
  var allowed = viewerLevel >= effectiveTargetTier;

  return {
    allowed: allowed,
    reason: allowed ? null : 'Viewer tier insufficient',
    viewerLevel: viewerLevel,
    targetTier: effectiveTargetTier
  };
}

function getDefaultEntityTier(entityType) {
  switch (String(entityType).toLowerCase()) {
    case 'student':
      return 1;
    case 'staff':
      return 2;
    default:
      return 7;
  }
}

function filterInsightsForViewer(insights, viewerRole) {
  var viewerLevel = getViewerLevel(viewerRole);
  if (viewerLevel === null) {
    return [];
  }
  return insights.filter(function(insight) {
    var insightTier = getDefaultEntityTier(insight.scopeType || insight.scope_type);
    return viewerLevel >= insightTier;
  });
}

function getVisibleFieldsForRole(role, entityType) {
  return { allowed: true, redactFields: [] };
}

function clearCache() {
  hierarchyCache = null;
  lastRefresh = 0;
}

module.exports = {
  refreshHierarchy: refreshHierarchy,
  getViewerLevel: getViewerLevel,
  canSeeTier: canSeeTier,
  canSeeRole: canSeeRole,
  checkAccess: checkAccess,
  filterInsightsForViewer: filterInsightsForViewer,
  getVisibleFieldsForRole: getVisibleFieldsForRole,
  clearCache: clearCache
};
