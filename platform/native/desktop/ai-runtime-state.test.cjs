const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AiRuntimeState } = require('./ai-runtime-state.cjs');
test('credential failure clears inherited AI configuration without blocking startup', async () => {
  const state = new AiRuntimeState();
  const snapshot = await state.resolve({ activeEnvironment: async () => { throw Error('private credential error'); } });
  assert.equal(snapshot.unavailable, true);
  assert.equal(snapshot.environment.RESEARCHED_AI_PROTOCOL, '');
  assert.equal(snapshot.environment.TIMSYS_AI_API_KEY, '');
  assert.equal(JSON.stringify(state.status('researched', 'stopped', snapshot)).includes('private'), false);
});
test('running apps require restart after connection changes and clear it after reopening', async () => {
  const state = new AiRuntimeState(); let model = 'one';
  const vault = { activeEnvironment: async () => ({ TIMSYS_AI_PROTOCOL: 'gemini', TIMSYS_AI_MODEL: model, TIMSYS_AI_API_KEY: 'private-key' }) };
  const first = await state.resolve(vault); state.markStarted('researched', first);
  assert.equal(state.status('researched', 'running', first).restartRequired, false);
  model = 'two'; const next = await state.resolve(vault);
  assert.equal(state.status('researched', 'running', next).restartRequired, true);
  assert.equal(state.status('researched', 'stopped', next).restartRequired, false);
  state.markStarted('researched', next);
  assert.equal(state.status('researched', 'running', next).restartRequired, false);
  assert.equal(JSON.stringify(state.status('researched', 'running', next)).includes('private-key'), false);
});
