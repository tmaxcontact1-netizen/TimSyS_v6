'use strict';
// Backend/native consumer only: never expose the private service token to browser code.
const { BASE } = require('./service.cjs');
async function status({ port, token, signal }) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('INVALID_SERVICE_PORT');
  const response = await fetch(`http://127.0.0.1:${port}${BASE}/status`, { headers: { authorization: 'Bearer ' + token }, signal: signal || AbortSignal.timeout(3000) });
  if (!response.ok) throw Error('Q35_STATUS_UNAVAILABLE:' + response.status);
  const value = await response.json();
  if (value.serviceId !== 'tradeed-q35' || value.contractVersion !== '1.0.0') throw Error('Q35_CONTRACT_MISMATCH');
  return value;
}
module.exports = { status };
