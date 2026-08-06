'use strict';

const metadataService = require('./metadata');
const insightsService = require('./insights');
const logicService = require('./logic');

class IntelligenceServiceImpl {
  suggestMetadata(...args) { return metadataService.suggest(...args); }
  getMetadata(...args) { return metadataService.get(...args); }
  storeMetadata(...args) { return metadataService.store(...args); }
  synthesize(...args) { return insightsService.synthesize(...args); }
  getInsights(...args) { return insightsService.get(...args); }
  storeInsight(...args) { return insightsService.store(...args); }
  evaluateLogic(...args) { return logicService.evaluate(...args); }
  registerRule(...args) { return logicService.register(...args); }
  deleteRule(...args) { return logicService.delete(...args); }
  listRules(...args) { return logicService.list(...args); }
}

const intelligenceService = new IntelligenceServiceImpl();
module.exports = intelligenceService;