'use strict';

var WHITELIST = [
  { method: 'GET', pattern: '/api/auth/me' },
  { method: 'POST', pattern: '/api/auth/logout' },
  { method: 'POST', pattern: /^\/api\/users\/[^\/]+\/change-password$/ },
];

function isWhitelisted(method, pathname) {
  for (var i = 0; i < WHITELIST.length; i++) {
    var entry = WHITELIST[i];
    if (entry.method !== method) continue;
    if (typeof entry.pattern === 'string') {
      if (entry.pattern === pathname) return true;
    } else {
      if (entry.pattern.test(pathname)) return true;
    }
  }
  return false;
}

function passwordChangeRequiredMiddleware(req, res, pathname, method, respond) {
  if (!req.user || !req.user.mustChangePassword) return true;

  if (isWhitelisted(method, pathname)) return true;

  respond(res, 403, {
    success: false,
    error: {
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must change your password before accessing this resource.',
    },
  });

  return false;
}

module.exports = passwordChangeRequiredMiddleware;