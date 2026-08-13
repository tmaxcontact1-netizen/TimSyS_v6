'use strict';

const uiStandard = require('../../modules/builder/ui-standard');
const assembler = require('../../modules/builder/assembler');
const fs = require('fs');
const path = require('path');

describe('application UI generation standard', function() {
  test('defines the non-optional universal interaction baseline', function() {
    expect(uiStandard.contract.required).toBe(true);
    expect(uiStandard.contract.lists.maximumPageSize).toBe(50);
    expect(uiStandard.contract.lists.serverPaginated).toBe(true);
    expect(uiStandard.contract.lists.continuousRowNumbers).toBe(true);
    expect(uiStandard.contract.navigation.back).toBe(true);
    expect(uiStandard.contract.navigation.returnToLauncher).toBe(true);
    expect(uiStandard.contract.forms.protectUnsavedChanges).toBe(true);
    expect(uiStandard.contract.refresh.mustNotOverwriteDirtyForms).toBe(true);
    expect(uiStandard.contract.actions.nativePromptForbidden).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../../../', uiStandard.contract.implementation.react))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../../../', uiStandard.contract.implementation.vanilla))).toBe(true);
  });

  test('automatically applies the current standard to generated manifests', function() {
    const manifest = uiStandard.applyToManifest({ name: 'future_app' });
    expect(uiStandard.validateDeclaration(manifest.uiStandard)).toMatchObject({ valid: true, errors: [] });
  });

  test('includes the UI contract in every assembly preview', function() {
    const preview = assembler.dryRun({ name: 'future_ui_standard_test', components: [] });
    expect(preview.module.filesCreated).toContain('ui-standard.json');
  });

  test('rejects missing, optional, and outdated declarations', function() {
    expect(uiStandard.validateDeclaration(null).valid).toBe(false);
    expect(uiStandard.validateDeclaration({ id: uiStandard.contract.id, version: 0, required: true }).valid).toBe(false);
    expect(uiStandard.validateDeclaration({ id: uiStandard.contract.id, version: 1, required: false }).valid).toBe(false);
  });
});
