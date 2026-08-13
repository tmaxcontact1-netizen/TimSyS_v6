'use strict';

const fs = require('fs');
const path = require('path');
const uiStandard = require('./ui-standard');

const MODULES_DIR = path.resolve(__dirname, '../../modules');
const INCOMPLETE_MARKERS = ['MODULE_INCOMPLETE', 'Replace this generated handler'];

function safeName(name) {
  return typeof name === 'string' && /^[a-z][a-z0-9_]*$/.test(name);
}

function inspect(name) {
  if (!safeName(name)) return { valid: false, errors: ['Invalid module name'] };
  const dir = path.join(MODULES_DIR, name);
  const manifestPath = path.join(dir, 'module.json');
  const indexPath = path.join(dir, 'index.js');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) {
    return { valid: false, errors: ['Module files are incomplete'] };
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (error) { return { valid: false, errors: ['Invalid module.json: ' + error.message] }; }
  const source = fs.readFileSync(indexPath, 'utf8');
  const errors = [];
  if (manifest.name !== name) errors.push('Manifest name does not match its directory');
  if (!Array.isArray(manifest.routes) || !Array.isArray(manifest.functions)) errors.push('Routes and functions must be arrays');
  const uiReview = uiStandard.validateDeclaration(manifest.uiStandard);
  errors.push(...uiReview.errors);
  if (!fs.existsSync(path.join(dir, 'ui-standard.json'))) errors.push('ui-standard.json is required');
  const functions = new Map((manifest.functions || []).map((fn) => [fn.name, fn.exports]));
  (manifest.routes || []).forEach((route) => {
    const exportName = functions.get(route.handler);
    if (!exportName) errors.push('Route handler has no function contract: ' + route.handler);
    else if (!new RegExp('(?:async\\s+)?function\\s+' + exportName + '\\s*\\(').test(source)) errors.push('Handler is not implemented: ' + exportName);
  });
  INCOMPLETE_MARKERS.forEach((marker) => { if (source.includes(marker)) errors.push('Generated placeholder remains: ' + marker); });
  return { valid: errors.length === 0, errors, manifest, manifestPath };
}

function listDrafts() {
  if (!fs.existsSync(MODULES_DIR)) return [];
  return fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, review: inspect(entry.name) }))
    .filter((item) => item.review.manifest && item.review.manifest.status === 'draft')
    .map((item) => ({ name: item.name, ready: item.review.valid, errors: item.review.errors }));
}

function activate(name) {
  const review = inspect(name);
  if (!review.valid) return review;
  if (review.manifest.status !== 'draft') return { valid: false, errors: ['Only draft modules can be activated'] };
  review.manifest.status = 'active';
  fs.writeFileSync(review.manifestPath, JSON.stringify(review.manifest, null, 2) + '\n');
  return { valid: true, errors: [], manifest: review.manifest };
}

module.exports = { inspect, listDrafts, activate };
