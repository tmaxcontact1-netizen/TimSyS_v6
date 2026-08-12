'use strict';

const fs = require('fs');
const path = require('path');

const modulesDir = path.resolve(__dirname, '../../modules');

describe('module route contracts', () => {
  test('every active route resolves to a declared, exported handler', () => {
    const failures = [];
    fs.readdirSync(modulesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).forEach((entry) => {
      const manifestPath = path.join(modulesDir, entry.name, 'module.json');
      const indexPath = path.join(modulesDir, entry.name, 'index.js');
      if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) return;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.status === 'draft') return;
      const implementation = require(indexPath);
      const contracts = new Map((manifest.functions || []).map((fn) => [fn.name, fn.exports]));
      (manifest.routes || []).forEach((route) => {
        if (!route.method || !route.path || typeof route.auth_required !== 'boolean') failures.push(`${manifest.name}: malformed route ${route.path || '<missing>'}`);
        const exportName = contracts.get(route.handler);
        if (!exportName) failures.push(`${manifest.name}: ${route.handler} has no function contract`);
        else if (typeof implementation[exportName] !== 'function') failures.push(`${manifest.name}: ${exportName} is not exported`);
      });
    });
    expect(failures).toEqual([]);
  });
});

describe('builder draft lifecycle', () => {
  test('all current drafts remain isolated and report why they cannot activate', () => {
    const lifecycle = require('../../modules/builder/lifecycle');
    lifecycle.listDrafts().forEach((draft) => {
      expect(draft.ready).toBe(false);
      expect(draft.errors.length).toBeGreaterThan(0);
    });
  });
});
