'use strict';

const metadataService = require('./metadata');
const logicService = require('./logic');
const products = require('./products');
const providerRunner = require('./providerRunner');
const withdrawalPatterns = require('./providers/withdrawal-patterns');
const registryQuality = require('./providers/registry-quality');
const operationalStrengths = require('./providers/operational-strengths');
const crossComponent = require('./providers/cross-component');
providerRunner.register(withdrawalPatterns);
providerRunner.register(registryQuality);
providerRunner.register(operationalStrengths);
providerRunner.register(crossComponent);

class IntelligenceServiceImpl {
  suggestMetadata(...args) { return metadataService.suggest(...args); }
  getMetadata(...args) { return metadataService.get(...args); }
  storeMetadata(...args) { return metadataService.store(...args); }
  evaluateLogic(...args) { return logicService.evaluate(...args); }
  registerRule(...args) { return logicService.register(...args); }
  deleteRule(...args) { return logicService.delete(...args); }
  listRules(...args) { return logicService.list(...args); }
  createProduct(...args) { return products.create(...args); }
  actOnProduct(...args) { return products.act(...args); }
  getProduct(...args) { return products.get(...args); }
  listProducts(...args) { return products.list(...args); }
  listVisibleProducts(...args) { return products.listVisible(...args); }
  getPortfolio(...args) { return products.portfolio(...args); }
  runProvider(...args) { return providerRunner.run(...args); }
  listProviders(...args) { return providerRunner.list(...args); }
}

const intelligenceService = new IntelligenceServiceImpl();
module.exports = intelligenceService;
