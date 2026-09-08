'use strict';

const fs = require('fs');
const path = require('path');
const appScope = require('../../shared/services/appScope');
const appCatalog = require('../../modules/builder/app-catalog');

describe('admin application baseline contract', function() {
  test('catalogue and scope service agree on supported admin apps', function() {
    expect(appCatalog.all().map(function(app) { return app.id; })).toEqual(expect.arrayContaining(appScope.all()));
    expect(appCatalog.all().map(function(app) { return app.id; })).toEqual(expect.arrayContaining(['memecoined', 'dressed', 'researched']));
    expect(appScope.all()).toEqual(['principal-ed']);
  });

  test('the current launcher has navigation and supervised-app controls', function() {
    const root = path.resolve(__dirname, '../../..');
    const dashboard = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/AppDashboard.jsx'), 'utf8');
    const store = fs.readFileSync(path.join(root, 'apps/launcher/src/store/appStore.js'), 'utf8');
    expect(dashboard).toContain("navigate('/')");
    expect(dashboard).toContain('startAndOpen');
    expect(dashboard).toContain('supervisedApp.stop');
    expect(store).toContain('memecoined');
    expect(store).toContain('dressed');
    expect(store).toContain('researched');
    expect(appCatalog.essentialServices().every(function(service) { return service.essential && !service.removable; })).toBe(true);
  });

  test('rejects unregistered application scopes', function() {
    expect(function() { appScope.fromRequest({ query: { app_id: 'made-up' }, body: {} }); }).toThrow('Unknown application scope');
  });

  test('launcher admin applications use the platform-root API client', function() {
    const root = path.resolve(__dirname, '../../..');
    const builderApi = fs.readFileSync(path.join(root, 'apps/launcher/src/api/builder.js'), 'utf8');
    const builderPage = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/ModulePortalPage.jsx'), 'utf8');
    expect(builderApi).toContain("baseURL: '/'");
    expect(builderApi).toContain("platformClient.get('/builder/catalogue')");
    expect(builderPage).toContain('getBuilderCatalogue');
    expect(builderPage).not.toContain("../api/base");
  });

  test('builder page provides bounded vertical scrolling', function() {
    const root = path.resolve(__dirname, '../../..');
    const builderPage = fs.readFileSync(path.join(root, 'apps/launcher/src/pages/ModulePortalPage.jsx'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'apps/launcher/src/styles.css'), 'utf8');
    expect(builderPage).toContain('builder-scroll-region');
    expect(builderPage).toContain('overflow-y-scroll');
    expect(styles).toContain('scrollbar-gutter: stable');
  });
});
