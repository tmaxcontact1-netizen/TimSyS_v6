'use strict';

const fs = require('fs');
const path = require('path');
const catalogue = require('../../modules/builder/app-catalog');
const appScope = require('../../shared/services/appScope');

describe('independent application boundaries', function() {
  const root = path.resolve(__dirname, '../../..');
  for (const id of ['memecoined', 'dressed', 'researched']) {
    test(`${id} is registered with TimSyS but cannot use school-domain scope`, function() {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps', id, 'timsys.app.json'), 'utf8'));
      expect(catalogue.get(id)).toMatchObject({ composition: 'independent-domain' });
      expect(manifest.platform).toMatchObject({ protocol: 'timsys.application.v1', composition: 'independent-domain', domainOwner: id });
      expect(function() { appScope.fromRequest({ query: { app_id: id }, body: {} }); }).toThrow('Unknown application scope');
    });
  }
});
