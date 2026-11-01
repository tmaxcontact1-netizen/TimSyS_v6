const fs = require('node:fs');
const path = require('node:path');
function resolveTradingDataRoot(root) {
  const current = path.join(root, 'tradeed');
  const legacy = path.join(root, 'memecoined');
  const populated = p => fs.existsSync(p) && fs.readdirSync(p).length > 0;
  if (populated(current) && populated(legacy) && fs.realpathSync(current) !== fs.realpathSync(legacy)) {
    throw new Error('Multiple trading data directories exist; explicit reconciliation is required before startup');
  }
  return populated(legacy) ? legacy : current;
}
function normalizeTradingEnvironment(environment) {
  const result = { ...environment };
  for (const [key, value] of Object.entries(environment)) {
    if (!key.startsWith('MEMECOINED_')) continue;
    const target = 'TRADEED_' + key.slice('MEMECOINED_'.length);
    if (result[target] !== undefined && result[target] !== value) throw new Error('Conflicting persisted trading setting: ' + target);
    result[target] = value;
  }
  return result;
}
module.exports = { resolveTradingDataRoot, normalizeTradingEnvironment };
