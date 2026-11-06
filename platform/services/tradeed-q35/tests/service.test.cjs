'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');
const { prepare, taskXml } = require('../prepare.cjs');
const { sha, alive } = require('../service.cjs');
const root = process.env.Q35_TEST_ROOT || path.resolve(__dirname, '..', 'verification-local', 'service-' + Date.now());
if (!root || !path.isAbsolute(root)) throw Error('EXPLICIT_DURABLE_TEST_ROOT_REQUIRED');
fs.mkdirSync(root, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 30000) { const start = Date.now(); while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await sleep(100); } throw Error('FIXTURE_TIMEOUT'); }
async function port() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function fixture(name, policy = 'restart') {
  const x = prepare({ destination: path.join(root, name), nodeExecutable: process.execPath,
    decimalDirectory: process.env.Q35_DECIMAL_ROOT || path.dirname(require.resolve('decimal.js/package.json', { paths: [path.resolve(__dirname, '../../tradeed')] })), fixture: true, port: await port(), workerPort: await port(), failurePolicy: policy });
  x.host = require(x.serviceFile); x.token = fs.readFileSync(x.config.tokenFile, 'utf8').trim(); return x;
}
const events = x => fs.readFileSync(path.join(x.config.logDirectory, 'incidents.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
test('deployment is sealed, live authority fails closed, and task is disabled with boot recovery', async () => {
  const x = await fixture('authority');
  x.host.validate(x.config);
  const xml = fs.readFileSync(path.join(x.root, 'task-DISABLED.xml'), 'utf16le');
  assert.match(xml, /<BootTrigger>/); assert.match(xml, /<StartWhenAvailable>true/); assert.match(xml, /<Enabled>false/);
  assert.match(xml, /<MultipleInstancesPolicy>IgnoreNew/); assert.match(xml, /<LogonType>Password/);
  const malicious = taskXml({ executable: 'C:\\a&b\\node.exe', serviceFile: 'C:\\file.cjs', configFile: 'C:\\config.json', account: 'a<b' });
  assert.match(malicious, /a&amp;b/); assert.match(malicious, /a&lt;b/);
  const job = JSON.parse(fs.readFileSync(x.config.jobFile)); job.mode = 'public_paper_collection'; job.collectionAuthorized = true;
  fs.writeFileSync(x.config.jobFile, JSON.stringify(job));
  assert.throws(() => x.host.validate(x.config), /SEAL_MISMATCH/);
  x.config.seals.find(s => s.file === x.config.jobFile).sha256 = sha(fs.readFileSync(x.config.jobFile));
  assert.throws(() => x.host.validate(x.config), /ENOENT/); // No live activation file is generated.
  fs.appendFileSync(path.join(x.config.runtimeDirectory, 'q35-prospective-core.cjs'), '\n');
  assert.throws(() => x.host.validate(x.config), /SEAL_MISMATCH/);
});
test('historical scientific source remains byte-identical and checkpoint corruption fails closed', async () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'runtime-provenance.json')));
  for (const file of provenance) {
    assert.equal(file.sha256, file.originalSha256);
    assert.equal(sha(fs.readFileSync(path.join(__dirname, '..', 'runtime', file.file))), file.sha256);
  }
  const x = await fixture('checkpoint-integrity');
  fs.mkdirSync(x.config.dataDirectory, { recursive: true });
  fs.writeFileSync(path.join(x.config.dataDirectory, 'checkpoint.json'), JSON.stringify({ body: { configHash: 'wrong' }, sha256: 'bad' }));
  await assert.rejects(x.host.run(x.config), /CHECKPOINT_INTEGRITY_OR_CONFIG_MISMATCH/);
});
test('unclean recovery requires explicit resume policy and a failed startup leaves no writer', async () => {
  const x = await fixture('review-required'); x.config.recoveryPolicy = 'review';
  fs.mkdirSync(x.config.logDirectory, { recursive: true });
  fs.writeFileSync(path.join(x.config.logDirectory, 'service-state.json'), JSON.stringify({ configHash: sha(JSON.stringify(x.config)), supervisorPid: 99999999, workerPid: 99999998, status: 'active' }));
  await assert.rejects(x.host.run(x.config), /UNCLEAN_RECOVERY_REQUIRES_AUTHORIZATION/);
  assert.equal(fs.existsSync(path.join(x.config.logDirectory, 'incidents.ndjson')), false);
  const y = await fixture('startup-write-failure');
  fs.mkdirSync(path.join(y.config.logDirectory, 'incidents.ndjson'), { recursive: true });
  await assert.rejects(y.host.run(y.config), /EISDIR|EPERM|EACCES/);
  const failed = JSON.parse(fs.readFileSync(path.join(y.config.logDirectory, 'service-state.json')));
  assert.equal(alive(failed.workerPid), false);
  assert.equal(fs.existsSync(path.join(y.config.dataDirectory, '.timsys-q35-owner.json')), false);
});
test('PID/HTTP supervision secures evidence then restarts, preserves checkpoint and excludes duplicate owners', { timeout: 60000 }, async () => {
  const x = await fixture('supervision'); const s = await x.host.run(x.config);
  try {
    await until(() => s.state.status === 'active');
    const url = `http://127.0.0.1:${x.config.port}${x.host.BASE}`;
    assert.equal((await fetch(url + '/status')).status, 401);
    const headers = { authorization: 'Bearer ' + x.token };
    assert.equal((await fetch(url + '/health', { headers })).status, 200);
    assert.equal((await fetch(url + '/status', { method: 'POST', headers })).status, 404);
    const h = await fetch(url + '/status', { headers }).then(r => r.json());
    assert.equal(h.workerPid, s.state.workerPid); assert.equal(h.heartbeatIntervalMs, 500);
    // Separate log directory and port still cannot get a second writer for the same ledger.
    await assert.rejects(x.host.run({ ...x.config, port: await port(), logDirectory: path.join(x.root, 'second-owner-logs') }), /EADDRINUSE|LEDGER_ALREADY_OWNED/);
    await until(() => fs.existsSync(path.join(x.config.dataDirectory, 'checkpoint.json')));
    const cp = x.host.checkpoint(x.config, s.state.ledgerConfigHash); assert.ok(cp.sha256);
    const old = s.state.workerPid; process.kill(old, 'SIGTERM');
    await until(() => s.state.workerPid !== old && s.state.status === 'active');
    assert.equal(alive(old), false);
    const e = events(x), evidence = e.findIndex(e => e.kind === 'evidence_secured');
    const restarts = e.map((v, i) => [v, i]).filter(([v]) => v.kind === 'worker_started');
    assert.equal(restarts.length, 2); assert.ok(evidence < restarts[1][1]);
    assert.ok(e.some(v => v.kind === 'heartbeat_failed' && v.consecutive === 2));
    assert.ok(e.some(v => v.kind === 'restart_gap' && v.checkpoint.sha256));
    assert.ok(fs.existsSync(path.join(x.config.logDirectory, 'alerts.ndjson')));
    assert.ok(fs.existsSync(path.join(s.state.evidence, 'ledger', 'checkpoint.json')));
    x.host.checkpoint(x.config, s.state.ledgerConfigHash);
  } finally { await s.stop(); }
});
test('stop policy captures evidence without automatic restart and refuses unattended recovery', { timeout: 45000 }, async () => {
  const x = await fixture('stop-policy', 'stop'), s = await x.host.run(x.config);
  try {
    await until(() => s.state.status === 'active'); process.kill(s.state.workerPid, 'SIGTERM');
    await until(() => s.state.status === 'failed_stopped');
    assert.equal(events(x).filter(e => e.kind === 'worker_started').length, 1);
    assert.ok(s.state.evidence); assert.equal(alive(s.state.workerPid), false);
  } finally { await s.stop(); }
  // A clean supervisor shutdown must not erase the failed validation latch.
  await assert.rejects(x.host.run(x.config), /FAILURE_REQUIRES_REVIEW/);
});
