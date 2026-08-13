'use strict';

const contract = require('../../shared/contracts/application-ui-standard.json');

function applyToManifest(manifest) {
  return {
    ...manifest,
    uiStandard: {
      id: contract.id,
      version: contract.version,
      required: true
    }
  };
}

function validateDeclaration(value) {
  const errors = [];
  if (!value || value.id !== contract.id) errors.push('Application UI standard declaration is required');
  if (!value || value.version !== contract.version) errors.push('Application UI standard version ' + contract.version + ' is required');
  if (value && value.required !== true) errors.push('Application UI standard cannot be optional');
  return { valid: errors.length === 0, errors, contract };
}

function assemblyFiles() {
  return ['ui-standard.json'];
}

module.exports = { contract, applyToManifest, validateDeclaration, assemblyFiles };
