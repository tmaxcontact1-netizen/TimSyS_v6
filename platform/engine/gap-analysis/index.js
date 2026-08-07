'use strict';

const calculator = require('./calculator');

class GapAnalysisEngine {
  analyze(moduleName) {
    return calculator.calculate(moduleName);
  }

  analyzeAll() {
    return calculator.analyzeAll();
  }

  getPlatformCompletion() {
    var results = this.analyzeAll();
    if (results.length === 0) return { averageCompletion: 0, status: 'red', moduleCount: 0 };
    var avg = Math.round(results.reduce(function(sum, r) { return sum + r.completionScore; }, 0) / results.length);
    return {
      averageCompletion: avg,
      status: avg < 25 ? 'red' : avg < 50 ? 'yellow' : 'green',
      moduleCount: results.length,
      modules: results
    };
  }
}

const engine = new GapAnalysisEngine();
module.exports = engine;
