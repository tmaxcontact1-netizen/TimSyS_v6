'use strict';

const http = require('http');
const url = require('url');
const crypto = require('crypto');

const { runMigrations, verifyTables } = require('./shared/migration-runner');
const moduleRegistry = require('./shared/registry/moduleRegistry');
const routeRegistry = require('./shared/registry/routeRegistry');
const functionRegistry = require('./shared/registry/functionRegistry');
const dependencyGraph = require('./shared/registry/dependencyGraph');
const discover = require('./shared/pipeline/discover');
const validate = require('./shared/pipeline/validate');
const register = require('./shared/pipeline/register');
const resolveStage = require('./shared/pipeline/resolve');
const wire = require('./shared/pipeline/wire');
const boot = require('./shared/pipeline/boot');
const unstage = require('./shared/pipeline/unstage');
const log = require('./shared/services/log');
const ratelimit = require("./shared/services/ratelimit");
const validation = require("./shared/services/validate");
const auth = require('./shared/services/auth');
const passwordChangeRequired = require('./shared/middleware/passwordChangeRequired');
const metrics = require('./shared/services/metrics');
const db = require('./shared/services/db');

const PORT = parseInt(process.env.PORT, 10) || 3000;
var contextRegistry = {};
var wiredModules = [];

var CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map(function(s) { return s.trim(); });
var RATE_LIMIT_WINDOW = 60000;
var RATE_LIMIT_DEFAULT = parseInt(process.env.RATE_LIMIT_DEFAULT, 10) || 100;
var RATE_LIMIT_ADMIN = parseInt(process.env.RATE_LIMIT_ADMIN, 10) || 500;

// In-memory rate limiting replaced by SQLite-backed service
ratelimit.initTable();

async function bootPlatform() {
  log.info('=== Platform Boot Starting ===');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    log.error('JWT_SECRET environment variable must be set with at least 32 characters');
    log.error('Example: export JWT_SECRET="your-long-secret-key-at-least-32-chars"');
    throw new Error('JWT_SECRET not set or too short (minimum 32 characters)');
  }

  log.info('Services initialized');

    await runMigrations();
  verifyTables();
  log.info('Migrations complete');

  db.query('DELETE FROM module_registry');
  db.query('DELETE FROM route_registry');
  db.query('DELETE FROM function_registry');
  db.query('DELETE FROM capability_registry');
  db.query('DELETE FROM schema_registry');
  log.info('Registries cleared');

  var discovered = discover();
  log.info('Discovered ' + discovered.length + ' module(s)', { modules: discovered.map(function(d) { return d.name; }) });

  var validated = discovered.map(function(d) { return validate(d); });
  log.info(validated.length + ' module(s) validated');

  var registered = validated.map(function(d) { return register(d); });
  log.info(registered.length + ' module(s) registered');

  resolveStage(registered);
  log.info('Dependencies resolved');

  var bootOrder = dependencyGraph.computeBootOrder();
  log.info('Boot order: ' + bootOrder.join(' -> '));

  var wired = registered.map(function(d) { return wire(d); });
  wiredModules = wired;
  log.info(wired.length + ' module(s) wired');

  for (var w = 0; w < wired.length; w++) {
    contextRegistry[wired[w].manifest.name] = wired[w].ctx;
  }

  var bootResults = boot(wired);
  var bootedCount = bootResults.filter(function(r) { return r.status === 'booted'; }).length;
  var failedCount = bootResults.filter(function(r) { return r.status === 'failed'; }).length;
  log.info('Boot results: ' + bootedCount + ' booted, ' + failedCount + ' failed');

  if (bootResults.some(function(r) { return r.status === 'failed'; })) {
    var failedNames = bootResults.filter(function(r) { return r.status === 'failed'; }).map(function(r) { return r.name; });
    log.error('Platform boot failed due to module boot errors', { failed: failedNames });
    for (var mod of wired) {
      if (bootResults.find(function(r) { return r.name === mod.manifest.name && r.status === 'booted'; })) {
        unstage(mod);
      }
    }
    throw new Error('Platform boot failed: ' + failedNames.join(', '));
  }

  log.info('=== Platform Boot Complete ===');

  var server = createServer();

  return new Promise(function(resolve, reject) {
    server.listen(PORT, function() {
      log.info('HTTP server listening on port ' + PORT);
      var events = require('./shared/services/events');
      events.publish('platform.ready', { timestamp: Date.now() });
      resolve(server);
    });
    server.on('error', reject);
  });
}

function matchRoute(pattern, pathname) {
  if (pattern === pathname) return { params: {} };

  if (pattern.includes(':')) {
    var paramNames = [];
    var regexPattern = pattern.replace(/:(\w+)/g, function(_, name) {
      paramNames.push(name);
      return '([^/]+)';
    });
    var regex = new RegExp('^' + regexPattern + '$');
    var match = pathname.match(regex);
    if (match) {
      var params = {};
      paramNames.forEach(function(name, i) {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return { params: params };
    }
  }

  return null;
}

function corsMiddleware(req, res) {
  var origin = req.headers.origin;
  if (CORS_ORIGINS.indexOf('*') !== -1) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && CORS_ORIGINS.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return false;
  }
  return true;
}

function httpsRedirectMiddleware(req, res) {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
  const xForwardedProto = req.headers['x-forwarded-proto'];

  if (NODE_ENV === 'production' && HTTPS_ENABLED) {
    const proto = xForwardedProto ? xForwardedProto.split(',')[0].trim() : (req.connection?.encrypted ? 'https' : 'http');

    if (proto !== 'https') {
      const host = req.headers.host;
      res.writeHead(301, { 'Location': 'https://' + host + req.url });
      res.end();
      return false;
    }
  }
  return true;
}

function cookieParserMiddleware(req) {
  req.cookies = {};
  var cookieHeader = req.headers.cookie;
  if (!cookieHeader) return;
  var pairs = cookieHeader.split(';');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].trim().split('=');
    if (pair.length === 2) {
      req.cookies[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
  }
}

function csrfMiddleware(req, res) {
  var stateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (stateChanging.indexOf(req.method.toUpperCase()) === -1) return true;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return true;
  }

  if (!req.headers['x-requested-with'] || req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    respond(res, 403, {
      success: false,
      error: { code: 'CSRF_VALIDATION_FAILED', message: 'CSRF token missing: X-Requested-With header required for cookie-based requests' },
    });
    return false;
  }
  return true;
}

function authenticationMiddleware(req, res, route) {
  if (!route.auth_required) return true;

  var authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    respond(res, 401, {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return false;
  }

  try {
    var token = authHeader.split(' ')[1];
    var payload = auth.verifyToken(token);
    req.user = { id: payload.userId, permissions: payload.permissions || [], mustChangePassword: payload.mustChangePassword || false };
    return true;
  } catch (err) {
    respond(res, 401, {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return false;
  }
}

function sanitizationMiddleware(req) {
  if (req.body && typeof req.body === 'object') req.body = validation.sanitize(req.body);
  if (req.query && typeof req.query === 'object') req.query = validation.sanitize(req.query);
  return true;
}

function rateLimitMiddleware(req, res) {
  var ip = req.socket.remoteAddress || "unknown";
  var userId = req.user ? req.user.id : ip;
  var limit = RATE_LIMIT_DEFAULT;
  if (req.user && req.user.permissions) {
    if (req.user.permissions.indexOf("admin:*") !== -1) {
      limit = RATE_LIMIT_ADMIN;
    }
  }
  var key = ratelimit.getKey(userId, limit);
  var result = ratelimit.recordRequest(key, RATE_LIMIT_WINDOW, limit);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  res.setHeader("X-RateLimit-Reset", String(result.resetAt));
  if (!result.allowed) {
    respond(res, 429, { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Rate limit exceeded. Try again in " + Math.ceil((result.resetAt - Date.now()) / 1000) + " seconds." } });
    return false;
  }
  return true;
}

function shutdownPlatform(server) {
  return new Promise(function(resolve) {
    function cleanup() {
      var reversed = wiredModules.slice().reverse();
      for (var i = 0; i < reversed.length; i++) {
        try { unstage(reversed[i]); } catch (err) { log.error('Shutdown teardown failed: ' + reversed[i].manifest.name, { error: err.message }); }
      }
      try { if (typeof db.close === 'function') db.close(); } catch (err) {}
      wiredModules = [];
      contextRegistry = {};
      resolve();
    }
    if (server) { server.close(cleanup); } else { cleanup(); }
  });
}

function createServer() {
  return http.createServer(async function(req, res) {
    var start = Date.now();
    var parsedUrl = url.parse(req.url, true);
    var pathname = parsedUrl.pathname;
    var query = parsedUrl.query;
    var method = req.method.toUpperCase();

    if (!corsMiddleware(req, res)) return;

    if (!httpsRedirectMiddleware(req, res)) return;

    metrics.increment('http.requests_total', { method: method, path: pathname });

    try {
      cookieParserMiddleware(req);

      if (!csrfMiddleware(req, res)) return;

      var route = null;
      var routeParams = {};

      for (var i = 0; i < routeRegistry.getAll().length; i++) {
        var r = routeRegistry.getAll()[i];
        if (r.method !== method) continue;
        var match = matchRoute(r.path, pathname);
        if (match) {
          route = r;
          routeParams = match.params;
          break;
        }
      }

      if (!route) {
        respond(res, 404, {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Route not found: ' + method + ' ' + pathname },
        });
        return;
      }

      if (!authenticationMiddleware(req, res, route)) return;

      var body = {};
      if (['POST', 'PUT', 'PATCH'].indexOf(method) !== -1) {
        body = await readBody(req);
      }

      if (!sanitizationMiddleware(req)) return;
      if (!rateLimitMiddleware(req, res)) return;

      if (!passwordChangeRequired(req, res, pathname, method, respond)) return;

      log.info('Request: ' + method + ' ' + pathname, {
        method: method,
        path: pathname,
        userId: req.user ? req.user.id : 'anonymous',
      });

      var handler = functionRegistry.get(route.handler);
      if (!handler || typeof handler.implementation !== 'function') {
        respond(res, 500, {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Handler not found: ' + route.handler },
        });
        return;
      }

      var handlerReq = {
        method: method,
        query: query,
        body: body,
        params: routeParams,
        user: req.user,
        headers: req.headers,
        cookies: req.cookies,
      };

      var moduleName = handler.module || 'unknown';
      var moduleCtx = contextRegistry[moduleName] || { requestTime: start };

      var result = await handler.implementation(handlerReq, moduleCtx);

      var statusCode = result && result.statusCode ? result.statusCode : 200;
      respond(res, statusCode, (result && result.data) || result || { success: true });

      metrics.timing('http.request_duration_ms', Date.now() - start, { method: method, path: pathname });

    } catch (err) {
      log.error('HTTP request failed', {
        method: method,
        path: pathname,
        error: err.message,
        stack: err.stack,
      });
      metrics.increment('http.errors_total', { method: method, path: pathname });
      respond(res, 500, {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  });
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var data = '';
    req.on('data', function(chunk) {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new Error('Request body too large (max 1MB)'));
    });
    req.on('end', function() {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function respond(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(Object.assign({}, data, {
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  })));
}

var currentServer = null;

if (require.main === module) {
  bootPlatform().then(function(server) {
    currentServer = server;
    process.on('SIGTERM', function() {
      log.info('SIGTERM received, shutting down...');
      shutdownPlatform(currentServer).then(function() { process.exit(0); });
    });
    process.on('SIGINT', function() {
      log.info('SIGINT received, shutting down...');
      shutdownPlatform(currentServer).then(function() { process.exit(0); });
    });
  }).catch(function(err) {
    log.error('Platform failed to start', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

module.exports = { bootPlatform: bootPlatform, createServer: createServer, shutdownPlatform: shutdownPlatform };