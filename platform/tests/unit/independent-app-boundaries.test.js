'use strict';

const fs = require('fs');
const path = require('path');
const catalogue = require('../../modules/builder/app-catalog');
const appScope = require('../../shared/services/appScope');

describe('independent application boundaries', function() {
  const root = path.resolve(__dirname, '../../..');
  for (const id of ['tradeed', 'dressed', 'researched']) {
    test(`${id} is registered with TimSyS but cannot use school-domain scope`, function() {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps', id, 'timsys.app.json'), 'utf8'));
      expect(catalogue.get(id)).toMatchObject({ composition: 'independent-domain' });
      expect(manifest).toMatchObject({kind:'frontend',backend:{owner:'timsys',version:'1.0.0'}});
      expect(manifest.processes).toBeUndefined();
      const service=JSON.parse(fs.readFileSync(path.join(root,'platform/services',id,'timsys.app.json'),'utf8'));
      expect(service.ownership.runtime).toBe('timsys');
      expect(function() { appScope.fromRequest({ query: { app_id: id }, body: {} }); }).toThrow('Unknown application scope');
    });
  }
});
