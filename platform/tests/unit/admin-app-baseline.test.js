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

  test('launcher admin applications use the platform-root API client', function() {
    const root = path.resolve(__dirname, '../../..');
    const builderApi = fs.readFileSync(path.join(root, 'apps/launcher/src/api/builder.js'), 'utf8');
    const builderPage = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/ModulePortalPage.jsx'), 'utf8');
    const heartbeat = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/AdminHeartbeatPage.jsx'), 'utf8');
    expect(builderApi).toContain("baseURL: '/'");
    expect(builderApi).toContain("platformClient.get('/builder/catalogue')");
    expect(builderPage).toContain('getBuilderCatalogue');
    expect(heartbeat).toContain('platformClient');
    expect(builderPage).not.toContain("../api/base");
    expect(heartbeat).not.toContain("../api/base");
  });

  test('builder and heartbeat pages provide bounded vertical scrolling', function() {
    const root = path.resolve(__dirname, '../../..');
    const builderPage = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/ModulePortalPage.jsx'), 'utf8');
    const heartbeat = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/AdminHeartbeatPage.jsx'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'apps/launcher/src/styles.css'), 'utf8');
    expect(builderPage).toContain('builder-scroll-region');
    expect(builderPage).toContain('overflow-y-scroll');
    expect(heartbeat).toContain('overflow-y-auto');
    expect(styles).toContain('scrollbar-gutter: stable');
  });
});
