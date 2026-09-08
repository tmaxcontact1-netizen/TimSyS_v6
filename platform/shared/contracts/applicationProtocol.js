'use strict';

const PROTOCOL = 'timsys.application.v1';
const STATES = new Set(['healthy', 'degraded', 'blocked', 'unavailable']);

function validateHealth(value, expectedApplication) {
  if (!value || typeof value !== 'object') throw new TypeError('Health response must be an object');
  if (value.protocol !== PROTOCOL) throw new TypeError(`Unsupported application protocol: ${value.protocol || 'missing'}`);
  if (value.application !== expectedApplication) throw new TypeError(`Health application mismatch: expected ${expectedApplication}`);
  if (!STATES.has(value.status)) throw new TypeError(`Unsupported health status: ${value.status}`);
  if (!Number.isFinite(Date.parse(value.observedAt))) throw new TypeError('Health observedAt must be an ISO date-time');
  if (!Array.isArray(value.components)) throw new TypeError('Health components must be an array');
  for (const component of value.components) {
    if (!component || typeof component.id !== 'string' || !component.id || !STATES.has(component.status)) {
      throw new TypeError('Invalid component health entry');
    }
  }
  return value;
}

module.exports = Object.freeze({ PROTOCOL, validateHealth });
