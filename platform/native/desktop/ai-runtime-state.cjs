'use strict';
const { createHash } = require('node:crypto');
const fields = ['PROFILE_ID', 'PROTOCOL', 'MODEL', 'BASE_URL', 'API_KEY'];
const emptyEnvironment = () => Object.fromEntries(['TIMSYS', 'RESEARCHED'].flatMap(prefix => fields.map(field => [prefix + '_AI_' + field, ''])));
class AiRuntimeState {
  constructor() { this.started = new Map(); }
  async resolve(vault) {
    let environment = emptyEnvironment(), unavailable = false;
    try { environment = { ...environment, ...await vault.activeEnvironment() }; }
    catch (_) { unavailable = true; }
    return { environment, unavailable, fingerprint: createHash('sha256').update(JSON.stringify(fields.map(field => environment['TIMSYS_AI_' + field]))).digest('hex') };
  }
  markStarted(app, snapshot) { this.started.set(app, snapshot.fingerprint); }
  status(app, state, snapshot) {
    const running = ['running', 'starting', 'degraded'].includes(state);
    return { app, restartRequired: running && this.started.has(app) && this.started.get(app) !== snapshot.fingerprint,
      aiAvailable: !snapshot.unavailable && Boolean(snapshot.environment.TIMSYS_AI_MODEL),
      ...(snapshot.unavailable ? { warning: 'The saved AI connection could not be loaded. Deterministic analysis remains available.' } : {}) };
  }
}
module.exports = { AiRuntimeState };
