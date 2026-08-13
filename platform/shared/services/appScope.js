'use strict';

const ADMIN_APPS = new Set(['principal-ed', 'competeed', 'sanctifyed']);

function fromRequest(req) {
  const value = (req.query && req.query.app_id) || (req.body && req.body.app_id) || 'principal-ed';
  if (!ADMIN_APPS.has(value)) {
    const error = new Error('Unknown application scope');
    error.code = 'INVALID_APP_SCOPE';
    throw error;
  }
  return value;
}

function invalid(error) {
  return { success: false, statusCode: 400, error: { code: error.code || 'INVALID_APP_SCOPE', message: error.message } };
}

module.exports = { fromRequest, invalid, all: function() { return Array.from(ADMIN_APPS); } };
