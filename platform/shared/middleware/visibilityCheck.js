'use strict';

var visibilityFilter = require('../services/visibilityFilter');

// Entity type to route prefix mapping
var ENTITY_PREFIXES = {
  'student': ['/students/', '/student-profiles'],
  'staff': ['/staff/', '/staff-profiles'],
  'room': ['/rooms/'],
  'inventory': ['/inventory/'],
  'insight': ['/insights/']
};

function detectEntityType(path) {
  for (var entityType in ENTITY_PREFIXES) {
    var prefixes = ENTITY_PREFIXES[entityType];
    for (var i = 0; i < prefixes.length; i++) {
      if (path.indexOf(prefixes[i]) !== -1) {
        return entityType;
      }
    }
  }
  return null;
}

// Routes that don't require visibility checking (auth, health, etc.)
var EXEMPT_PATHS = [
  '/api/auth/',
  '/api/users/',
  '/health',
  '/platform/'
];

function isExempt(path) {
  for (var i = 0; i < EXEMPT_PATHS.length; i++) {
    if (path.indexOf(EXEMPT_PATHS[i]) === 0) {
      return true;
    }
  }
  return false;
}

function createVisibilityMiddleware(config) {
  return function(req, res, next) {
    var path = req.path || '';
    
    // Skip exempt routes
    if (isExempt(path)) {
      return next();
    }
    
    // Get viewer role from authenticated user
      // Derive role from permissions
  var viewerRole = 'guest';
  if (req.user && req.user.permissions) {
    var perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (perms.indexOf('admin:*') !== -1) {
      viewerRole = 'developer';
    } else if (perms.some(function(p) { return p.indexOf('admin:principal') !== -1; })) {
      viewerRole = 'principal';
    } else if (perms.some(function(p) { return p.indexOf('admin:ap') !== -1 || p.indexOf('admin:assistant_principal') !== -1; })) {
      viewerRole = 'assistant_principal';
    } else if (perms.some(function(p) { return p.indexOf('admin:hod') !== -1 || p.indexOf('admin:head_of_department') !== -1; })) {
      viewerRole = 'head_of_department';
    } else if (perms.some(function(p) { return p.indexOf('admin:teacher') !== -1; })) {
      viewerRole = 'teacher';
    } else if (perms.some(function(p) { return p.indexOf('student:') !== -1; })) {
      viewerRole = 'student';
    }
  }
    
    // Detect entity type from path
    var entityType = detectEntityType(path);
    
    // If we can't determine entity type, allow through (let handler decide)
    if (!entityType) {
      return next();
    }
    
    // Coarse gate: check if viewer can access this entity type at all
    var checkResult = visibilityFilter.checkAccess(viewerRole, entityType);
    
    if (!checkResult.allowed) {
      config.ctx.log.warn('Visibility check failed', {
        path: path,
        method: req.method,
        viewerRole: viewerRole,
        entityType: entityType,
        reason: checkResult.reason
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Insufficient permissions for this entity type'
        }
      });
    }
    
    // Attach viewer info to request for handler use
    req.visibility = {
      viewerRole: viewerRole,
      viewerRank: checkResult.viewerRank,
      entityType: entityType
    };
    
    next();
  };
}

module.exports = createVisibilityMiddleware;
