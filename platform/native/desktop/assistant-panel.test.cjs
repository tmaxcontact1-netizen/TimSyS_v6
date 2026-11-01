const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AssistantPanels } = require('./assistant-panel.cjs');
test('ResearchEd page capture cannot bypass authorised evidence projection', async () => {
  const panels = new AssistantPanels({}); const sender = {};
  panels.panels.set(1, { appId: 'researched', view: { webContents: sender }, window: { isDestroyed: () => false, webContents: { executeJavaScript: () => assert.fail('must not scrape ResearchEd page') } } });
  await assert.rejects(panels.contextFor(sender), /blind review/);
});
