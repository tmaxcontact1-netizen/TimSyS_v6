'use strict';

const fs = require('fs');
const path = require('path');
const appScope = require('../../shared/services/appScope');
const appCatalog = require('../../modules/builder/app-catalog');

describe('admin application baseline contract', function() {
  test('catalogue and scope service agree on supported admin apps', function() {
    expect(appCatalog.all().map(function(app) { return app.id; })).toEqual(appScope.all());
    expect(appCatalog.all().some(function(app) { return app.id === 'memecoined'; })).toBe(false);
  });

  test('every admin app has the standard shell, navigation and foundational modules', function() {
    const root = path.resolve(__dirname, '../../..');
    const shell = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/AdminHeartbeatPage.jsx'), 'utf8');
    expect(shell).toContain('Return to launcher');
    expect(shell).toContain('Places');
    expect(shell).toContain('Stuff');
    expect(appCatalog.essentialServices().every(function(service) { return service.essential && !service.removable; })).toBe(true);
  });

  test('rejects unregistered application scopes', function() {
    expect(function() { appScope.fromRequest({ query: { app_id: 'made-up' }, body: {} }); }).toThrow('Unknown application scope');
  });
});
