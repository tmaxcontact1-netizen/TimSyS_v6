'use strict';

var db = require('../../shared/services/db');
var fs = require('fs');
var path = require('path');

function boot(ctx) {
  ctx.log.info('app_registry booting', { module: 'app_registry' });
}

function teardown(ctx) {
  ctx.log.info('app_registry tearing down', { module: 'app_registry' });
}

function listApps(req, ctx) {
  var result = db.query('SELECT * FROM apps WHERE active = 1 ORDER BY display_name ASC');
  return { success: true, data: result.rows };
}

function getApp(req, ctx) {
  var id = req.params.id;
  var result = db.query('SELECT * FROM apps WHERE id = ? OR app_id = ?', [id, id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'App not found' } };
  }
  return { success: true, data: result.rows[0] };
}

function createApp(req, ctx) {
  var body = req.body || {};
  var now = new Date().toISOString();
  
  db.query(
    "INSERT INTO apps (app_id, display_name, version, description, icon_url, entry_point, capabilities, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [body.app_id, body.display_name, body.version || '1.0.0', body.description || '', body.icon_url || '', body.entry_point || '/', JSON.stringify(body.capabilities || {}), 1]
  );
  
  return { success: true, data: { created: true, appId: body.app_id } };
}

function updateApp(req, ctx) {
  var id = req.params.id;
  var body = req.body || {};
  var now = new Date().toISOString();
  
  var fields = [];
  var params = [];
  
  if (body.display_name) { fields.push('display_name = ?'); params.push(body.display_name); }
  if (body.version) { fields.push('version = ?'); params.push(body.version); }
  if (body.description !== undefined) { fields.push('description = ?'); params.push(body.description); }
  if (body.icon_url !== undefined) { fields.push('icon_url = ?'); params.push(body.icon_url); }
  if (body.entry_point !== undefined) { fields.push('entry_point = ?'); params.push(body.entry_point); }
  if (body.capabilities !== undefined) { fields.push('capabilities = ?'); params.push(JSON.stringify(body.capabilities)); }
  if (body.active !== undefined) { fields.push('active = ?'); params.push(body.active ? 1 : 0); }
  
  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);
  
  db.query("UPDATE apps SET " + fields.join(', ') + " WHERE id = ? OR app_id = ?", params);
  
  return { success: true, data: { updated: true } };
}

function deleteApp(req, ctx) {
  var id = req.params.id;
  db.query("DELETE FROM apps WHERE id = ? OR app_id = ?", [id, id]);
  return { success: true, data: { deleted: true } };
}

function getUserSettings(req, ctx) {
  var userId = req.user ? req.user.id : null;
  if (!userId) {
    return { success: false, statusCode: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
  }
  
  var result = db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  if (result.rows.length === 0) {
    return { success: true, data: { preferences: {}, layout: [] } };
  }
  return { success: true, data: JSON.parse(result.rows[0].preferences_json) };
}

function saveUserSettings(req, ctx) {
  var userId = req.user ? req.user.id : null;
  var body = req.body || {};
  if (!userId) {
    return { success: false, statusCode: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } };
  }
  
  var check = db.query('SELECT id FROM user_settings WHERE user_id = ?', [userId]);
  if (check.rows.length > 0) {
    db.query("UPDATE user_settings SET preferences_json = ?, updated_at = datetime('now') WHERE user_id = ?", [JSON.stringify(body), userId]);
  } else {
    db.query("INSERT INTO user_settings (user_id, preferences_json, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))", [userId, JSON.stringify(body)]);
  }
  
  return { success: true, data: { saved: true } };
}

function streamNotifications(req, ctx) {
  // SSE streaming - placeholder for future implementation
  return { success: true, data: { streaming: true } };
}

// NEW: List all platform modules from disk
function listModules(req, ctx) {
  var modulesDir = path.join(__dirname, '..');
  var modules = [];
  
  try {
    var entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    
    entries.forEach(function(entry) {
      if (!entry.isDirectory()) return;
      
      var moduleName = entry.name;
      var moduleJsonPath = path.join(modulesDir, moduleName, 'module.json');
      
      if (!fs.existsSync(moduleJsonPath)) return;
      
      try {
        var moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
        
        // Check if module is enabled in DB
        var dbCheck = db.query('SELECT * FROM modules_config WHERE module_name = ?', [moduleName]);
        var enabled = true; // default to enabled
        if (dbCheck.rows.length > 0) {
          enabled = dbCheck.rows[0].enabled === 1;
        }
        
        modules.push({
          name: moduleJson.name || moduleName,
          version: moduleJson.version || '1.0.0',
          author: moduleJson.author || 'unknown',
          description: moduleJson.description || '',
          dependencies: moduleJson.dependencies || [],
          requires: moduleJson.requires || [],
          provides: moduleJson.provides || [],
          routes: moduleJson.routes || [],
          functions: moduleJson.functions || [],
          schema: moduleJson.schema || {},
          events: moduleJson.events || {},
          enabled: enabled,
          path: '/platform/modules/' + moduleName
        });
      } catch (parseErr) {
        ctx.log.warn('Failed to parse module.json', { module: moduleName, error: parseErr.message });
      }
    });
  } catch (readErr) {
    ctx.log.error('Failed to scan modules directory', { error: readErr.message });
    return { success: false, statusCode: 500, error: { code: 'INTERNAL_ERROR', message: 'Failed to scan modules' } };
  }
  
  return { success: true, data: Array.isArray(modules) ? modules : Object.values(modules) };
}

// NEW: Enable/disable module
function setModuleState(req, ctx) {
  var moduleName = req.params.moduleName;
  var newState = req.body && req.body.enabled !== undefined ? req.body.enabled : true;
  
  var check = db.query('SELECT id FROM modules_config WHERE module_name = ?', [moduleName]);
  var now = new Date().toISOString();
  
  if (check.rows.length > 0) {
    db.query("UPDATE modules_config SET enabled = ?, updated_at = ? WHERE module_name = ?", [newState ? 1 : 0, now, moduleName]);
  } else {
    db.query("INSERT INTO modules_config (module_name, enabled, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))", [moduleName, newState ? 1 : 0]);
  }
  
  
  return { success: true, data: { moduleName: moduleName, enabled: newState } };
}



// NEW: Assign module to app
function assignModuleToApp(req, ctx) {
  var appId = req.body && req.body.appId;
  var moduleName = req.body && req.body.moduleName;
  
  if (!appId || !moduleName) {
    return { success: false, statusCode: 400, error: { code: 'MISSING_PARAMS', message: 'appId and moduleName required' } };
  }
  
  var db = require('../../shared/services/db');
  var now = new Date().toISOString();
  
  // Check if assignment exists
  var check = db.query('SELECT id FROM app_modules WHERE app_id = ? AND module_name = ?', [appId, moduleName]);
  
  if (check.rows.length > 0) {
    // Update existing
    db.query('UPDATE app_modules SET enabled = 1, updated_at = ? WHERE app_id = ? AND module_name = ?', [now, appId, moduleName]);
  } else {
    // Insert new
    db.query('INSERT INTO app_modules (app_id, module_name, enabled, created_at, updated_at) VALUES (?, ?, 1, datetime(?), datetime(?))', [appId, moduleName, now, now]);
  }
  
  return { success: true, data: { appId: appId, moduleName: moduleName, enabled: true } };
}

// NEW: Remove module from app
function removeModuleFromApp(req, ctx) {
  var appId = req.query && req.query.appId;
  var moduleName = req.query && req.query.moduleName;
  
  if (!appId || !moduleName) {
    return { success: false, statusCode: 400, error: { code: 'MISSING_PARAMS', message: 'appId and moduleName required' } };
  }
  
  var db = require('../../shared/services/db');
  
  db.query('UPDATE app_modules SET enabled = 0, updated_at = ? WHERE app_id = ? AND module_name = ?', [new Date().toISOString(), appId, moduleName]);
  
  return { success: true, data: { appId: appId, moduleName: moduleName, enabled: false } };
}

// NEW: List modules for specific app
function listModulesForApp(req, ctx) {
  var appId = req.query && req.query.appId;
  
  if (!appId) {
    return { success: false, statusCode: 400, error: { code: 'MISSING_PARAM', message: 'appId required' } };
  }
  
  var db = require('../../shared/services/db');
  var fs = require('fs');
  var path = require('path');
  
  // Scan all modules
  var modulesDir = path.join(__dirname, '..');
  var modules = [];
  
  try {
    var entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    
    entries.forEach(function(entry) {
      if (!entry.isDirectory()) return;
      var moduleName = entry.name;
      var moduleJsonPath = path.join(modulesDir, moduleName, 'module.json');
      if (!fs.existsSync(moduleJsonPath)) return;
      
      try {
        var moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
        
        // Check app-specific assignment
        var appCheck = db.query('SELECT enabled FROM app_modules WHERE app_id = ? AND module_name = ?', [appId, moduleJson.name || moduleName]);
        var enabled = true; // default to enabled
        if (appCheck.rows.length > 0) {
          enabled = appCheck.rows[0].enabled === 1;
        }
        
        modules.push({
          name: moduleJson.name || moduleName,
          version: moduleJson.version || '1.0.0',
          dependencies: moduleJson.dependencies || [],
          requires: moduleJson.requires || [],
          provides: moduleJson.provides || [],
          routes: moduleJson.routes || [],
          functions: moduleJson.functions || [],
          schema: moduleJson.schema || {},
          events: moduleJson.events || {},
          enabled: enabled
        });
      } catch (parseErr) {}
    });
  } catch (readErr) {}
  
  return { success: true, data: modules };
}


module.exports = {
  assignModuleToApp,
  removeModuleFromApp,
  listModulesForApp,
  boot: boot,
  teardown: teardown,
  listApps: listApps,
  getApp: getApp,
  createApp: createApp,
  updateApp: updateApp,
  deleteApp: deleteApp,
  getUserSettings: getUserSettings,
  saveUserSettings: saveUserSettings,
  streamNotifications: streamNotifications,
  listModules: listModules,
  setModuleState: setModuleState
};
