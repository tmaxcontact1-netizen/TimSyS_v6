'use strict';
// TimSyS owns this service. The desktop launcher neither starts nor stops it.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { atomic } = require('./runtime/replay-durability.cjs');
const { ledgerConfigHash } = require('./runtime/q35-runtime-continuation.cjs');
const BASE = '/api/timsys/v1/services/tradeed-q35/1.0.0';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const alive = pid => { if (!Number.isSafeInteger(pid) || pid < 1) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
function append(file, record) {
  const fd = fs.openSync(file, 'a');
  try { fs.writeSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function within(parent, child) { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); }
function ancestry(pid) {
  if (process.platform !== 'win32') return [];
  const script = `$n=${Number(pid)};$seen=@{};$rows=while($n -and -not $seen.ContainsKey($n)){$seen[$n]=$true;$p=Get-CimInstance Win32_Process -Filter "ProcessId=$n";if(!$p){break};[pscustomobject]@{pid=$p.ProcessId;parent=$p.ParentProcessId;name=$p.Name;created=$p.CreationDate};$n=$p.ParentProcessId};ConvertTo-Json -InputObject @($rows) -Compress`;
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000 }));
}
function probe(port, pid) {
  return new Promise(resolve => {
    let ended = false;
    const finish = value => { if (!ended) { ended = true; resolve(value); } };
    const req = http.get({ host: '127.0.0.1', port, path: '/health' }, res => {
      let text = '';
      res.on('data', b => { text += b; if (text.length > 65536) req.destroy(); });
      res.on('end', () => { try { const h = JSON.parse(text); finish(res.statusCode === 200 && h.pid === pid ? h : null); } catch { finish(null); } });
    });
    req.setTimeout(1500, () => req.destroy()); req.on('error', () => finish(null));
  });
}
function validate(config) {
  if (config.schemaVersion !== 1 || config.serviceId !== 'tradeed-q35') throw Error('SERVICE_CONTRACT_REQUIRED');
  for (const key of ['runtimeDirectory', 'dataDirectory', 'logDirectory', 'executable', 'jobFile', 'tokenFile']) {
    if (typeof config[key] !== 'string' || !path.isAbsolute(config[key])) throw Error('ABSOLUTE_PATH_REQUIRED:' + key);
    if (/timsys.launcher|[\\/](temp|tmp|backups)[\\/]/i.test(config[key])) throw Error('NON_DURABLE_PATH:' + key);
    if (/[\\/]Programs[\\/]TimSyS(?: Launcher)?[\\/]|[\\/]apps[\\/]launcher[\\/]/i.test(config[key])) throw Error('LAUNCHER_BUNDLE_FORBIDDEN:' + key);
  }
  const roots = ['runtimeDirectory', 'dataDirectory', 'logDirectory'];
  for (const a of roots) for (const b of roots) if (a !== b && within(config[a], config[b])) throw Error('OVERLAPPING_SERVICE_PATHS');
  for (const key of ['port', 'workerPort']) if (!Number.isInteger(config[key]) || config[key] < 1024 || config[key] > 65535) throw Error('INVALID_PORT');
  if (config.port === config.workerPort) throw Error('SEPARATE_PORTS_REQUIRED');
  if (!Number.isInteger(config.intervalMs) || config.intervalMs < 100 || config.intervalMs > 60000) throw Error('MONITOR_INTERVAL_REQUIRED');
  if (!Number.isInteger(config.startupGraceMs) || config.startupGraceMs < 100 || config.startupGraceMs > 60000) throw Error('STARTUP_GRACE_REQUIRED');
  if (!['stop', 'restart'].includes(config.failurePolicy)) throw Error('FAILURE_POLICY_REQUIRED');
  if (!['review', 'resume'].includes(config.recoveryPolicy)) throw Error('RECOVERY_POLICY_REQUIRED');
  if (!Array.isArray(config.seals) || !config.seals.length) throw Error('DEPLOYMENT_SEALS_REQUIRED');
  for (const seal of config.seals) {
    if (!path.isAbsolute(seal.file) || sha(fs.readFileSync(seal.file)) !== seal.sha256) throw Error('DEPLOYMENT_SEAL_MISMATCH:' + seal.file);
  }
  // Every executable/runtime dependency must be in the deployment seal, not merely selected science files.
  const files = root => fs.readdirSync(root, { withFileTypes: true }).flatMap(e => {
    const file = path.join(root, e.name); if (e.isSymbolicLink()) throw Error('RUNTIME_LINK_FORBIDDEN');
    return e.isDirectory() ? files(file) : [file];
  });
  for (const file of [__filename, config.executable, config.jobFile, ...files(config.runtimeDirectory)]) {
    if (!config.seals.some(s => path.resolve(s.file) === path.resolve(file))) throw Error('UNSEALED_RUNTIME_FILE:' + file);
  }
  const token = fs.readFileSync(config.tokenFile, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('PRIVATE_SERVICE_TOKEN_REQUIRED');
  const job = read(config.jobFile), configHash = sha(JSON.stringify(config));
  const synthetic = ['synthetic_preflight', 'synthetic_adapter_preflight'].includes(job.mode) && job.collectionAuthorized === false;
  if (!synthetic) {
    if (job.mode !== 'public_paper_collection') throw Error('UNSUPPORTED_JOB');
    const approval = read(config.activationFile);
    if (approval.kind !== 'TIMSYS_Q35_SERVICE_ACTIVATION' || approval.approved !== true || approval.configHash !== configHash ||
        (config.failurePolicy === 'restart' && approval.restartAuthorized !== true) ||
        (config.recoveryPolicy === 'resume' && approval.recoveryAuthorized !== true)) throw Error('LIVE_SERVICE_ACTIVATION_NOT_AUTHORIZED');
    require(path.join(config.runtimeDirectory, 'q35-prospective-adapter.cjs')).authorize(job);
  }
  for (const item of job.inputHashes || []) if (sha(fs.readFileSync(item.file)) !== item.sha256) throw Error('JOB_INPUT_SEAL_MISMATCH');
  for (const item of job.frozenFiles || []) if (sha(fs.readFileSync(path.join(config.runtimeDirectory, item.file))) !== item.sha256) throw Error('SCIENCE_SEAL_MISMATCH');
  return { job, token, configHash, synthetic, ledgerHash: ledgerConfigHash(job) };
}
function checkpoint(config, ledgerHash) {
  const file = path.join(config.dataDirectory, 'checkpoint.json');
  if (!fs.existsSync(file)) return null;
  const cp = read(file);
  if (!cp.body || sha(JSON.stringify(cp.body)) !== cp.sha256 || cp.body.configHash !== ledgerHash) throw Error('CHECKPOINT_INTEGRITY_OR_CONFIG_MISMATCH');
  return { sha256: sha(fs.readFileSync(file)), lastAt: cp.body.lastAt };
}
async function run(config) {
  let verified = validate(config);
  const owners = ancestry(process.pid);
  if (owners.some(p => /timsys.*launcher/i.test(p.name))) throw Error('LAUNCHER_ANCESTRY_FORBIDDEN');
  for (const dir of [config.dataDirectory, config.logDirectory]) {
    fs.mkdirSync(dir, { recursive: true }); const file = path.join(dir, `.write-probe-${process.pid}`);
    const fd = fs.openSync(file, 'wx'); fs.writeSync(fd, 'durable'); fs.fsyncSync(fd); fs.closeSync(fd); fs.unlinkSync(file);
  }
  const stateFile = path.join(config.logDirectory, 'service-state.json');
  const incidents = path.join(config.logDirectory, 'incidents.ndjson');
  const event = (kind, detail = {}) => append(incidents, { at: new Date().toISOString(), kind, ...detail });
  const previous = fs.existsSync(stateFile) ? read(stateFile) : null;
  const failureLatch = path.join(config.logDirectory, 'failure-review-required.json');
  if (fs.existsSync(failureLatch)) throw Error('FAILURE_REQUIRES_REVIEW');
  if (previous && previous.configHash !== verified.configHash) throw Error('SERVICE_CONFIG_CHANGED');
  if (previous && ['failed_stopped', 'evidence_failed', 'blocked'].includes(previous.status)) throw Error('FAILURE_REQUIRES_REVIEW');
  checkpoint(config, verified.ledgerHash);
  let state = { schemaVersion: 1, serviceId: 'tradeed-q35', contractVersion: '1.0.0', configHash: verified.configHash,
    ledgerConfigHash: verified.ledgerHash, supervisorPid: process.pid, workerPid: null, status: 'starting',
    startedAt: new Date().toISOString(), lastCheck: null, failures: 0, firstFailureAt: null, synthetic: verified.synthetic };
  let worker, timer, busy = false, closing = false, lockOwned = false;
  const lock = path.join(config.dataDirectory, '.timsys-q35-owner.json');
  const mutex = net.createServer();
  const mutexName = process.platform === 'win32' ? '\\\\.\\pipe\\timsys-q35-' + sha(fs.realpathSync(config.dataDirectory).toLowerCase()) : path.join(config.dataDirectory, '.q35-owner.sock');
  const save = () => atomic(stateFile, state);
  const server = http.createServer((req, res) => {
    const supplied = req.headers.authorization || '', expected = 'Bearer ' + verified.token;
    if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) { res.writeHead(401); res.end(); return; }
    if (req.method !== 'GET' || ![BASE + '/health', BASE + '/status'].includes(req.url)) { res.writeHead(404); res.end(); return; }
    const healthy = state.status === 'active' && state.lastCheck && Date.now() - Date.parse(state.lastCheck) <= config.intervalMs + 5000;
    res.writeHead(req.url.endsWith('/health') && !healthy ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ...state, healthy, workerAlive: alive(state.workerPid), heartbeatIntervalMs: config.intervalMs }));
  });
  // Binding plus a durable ledger lock excludes both same-port and different-port duplicate owners.
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolve); });
  try {
    await new Promise((resolve, reject) => { mutex.once('error', reject); mutex.listen(mutexName, resolve); });
    if (fs.existsSync(lock)) { const owner = read(lock); if (alive(owner.pid) || alive(owner.workerPid)) throw Error('LEDGER_ALREADY_OWNED'); fs.unlinkSync(lock); }
    const fd = fs.openSync(lock, 'wx'); fs.writeSync(fd, JSON.stringify({ pid: process.pid, configHash: verified.configHash })); fs.fsyncSync(fd); fs.closeSync(fd); lockOwned = true;
    if (previous?.supervisorPid && alive(previous.supervisorPid)) throw Error('PREVIOUS_SUPERVISOR_ALIVE');
    const recover = previous && !['completed', 'stopped'].includes(previous.status);
    if (recover && config.recoveryPolicy !== 'resume') throw Error('UNCLEAN_RECOVERY_REQUIRES_AUTHORIZATION');
    if (previous?.status === 'completed') throw Error('COMPLETED_VALIDATION_REQUIRES_REVIEW');
    if (recover) event('unclean_supervisor_recovery', { previous, checkpoint: checkpoint(config, verified.ledgerHash), ancestry: owners });
    const start = async reason => {
      verified = validate(config); // Check sealed bytes and authority again before each restart.
      const cp = checkpoint(config, verified.ledgerHash);
      if (state.workerPid && alive(state.workerPid)) throw Error('OLD_WORKER_STILL_ALIVE');
      const reservation = net.createServer();
      await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(config.workerPort, '127.0.0.1', resolve); });
      await new Promise(resolve => reservation.close(resolve));
      const stamp = Date.now(), stdout = fs.openSync(path.join(config.logDirectory, `worker-${stamp}.stdout.log`), 'a');
      const stderr = fs.openSync(path.join(config.logDirectory, `worker-${stamp}.stderr.log`), 'a');
      worker = spawn(config.executable, [path.join(config.runtimeDirectory, 'q35-prospective-worker.cjs'), config.jobFile], {
        cwd: config.runtimeDirectory, windowsHide: true, stdio: ['ignore', stdout, stderr],
        env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH,
          CRYPTOED_SOAK_OUTPUT: config.dataDirectory, CRYPTOED_HEARTBEAT_PORT: String(config.workerPort),
          CRYPTOED_DURABILITY_LOG: path.join(config.logDirectory, 'durability-events.ndjson') }
      });
      fs.closeSync(stdout); fs.closeSync(stderr);
      await new Promise((resolve, reject) => { worker.once('spawn', resolve); worker.once('error', reject); });
      state.workerPid = worker.pid; state.status = 'starting'; state.startedAt = new Date().toISOString(); state.failures = 0; state.firstFailureAt = null;
      atomic(lock, { pid: process.pid, workerPid: worker.pid, configHash: verified.configHash });
      save(); event('worker_started', { pid: worker.pid, reason, checkpoint: cp });
    };
    const terminate = async () => {
      if (!alive(state.workerPid)) return;
      process.kill(state.workerPid, 'SIGTERM'); const deadline = Date.now() + 10000;
      while (alive(state.workerPid) && Date.now() < deadline) await sleep(50);
      if (alive(state.workerPid)) throw Error('WORKER_STOP_INCOMPLETE');
    };
    const preserve = () => {
      const destination = path.join(config.logDirectory, 'incidents', crypto.randomUUID()); fs.mkdirSync(destination, { recursive: true });
      // Capture all ledger bytes before any restart, including raw ingress subdirectories.
      fs.cpSync(config.dataDirectory, path.join(destination, 'ledger'), { recursive: true });
      fs.copyFileSync(config.jobFile, path.join(destination, 'job.json')); atomic(path.join(destination, 'state.json'), state);
      atomic(path.join(destination, 'ancestry.json'), ancestry(process.pid));
      if (process.platform === 'win32') for (const channel of ['System', 'Application']) {
        try { fs.writeFileSync(path.join(destination, channel + '.xml'), execFileSync('wevtutil.exe', ['qe', channel, '/q:*[System[TimeCreated[timediff(@SystemTime) <= 900000]]]', '/c:100', '/rd:true', '/f:xml'], { windowsHide: true, timeout: 15000 })); }
        catch (error) { fs.writeFileSync(path.join(destination, channel + '-capture-error.txt'), error.message); }
      }
      // Flush captured files before claiming evidence is secure.
      const flush = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) flush(p); else { const fd = fs.openSync(p, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd); } } }; flush(destination);
      event('evidence_secured', { destination }); return destination;
    };
    if (previous?.workerPid && alive(previous.workerPid)) {
      if (!(await probe(config.workerPort, previous.workerPid))) throw Error('ORPHAN_IDENTITY_UNVERIFIED');
      // Fail closed rather than adopting a PID whose executable/creation identity is ambiguous.
      throw Error('ORPHAN_WORKER_REQUIRES_REVIEW');
    }
    if (recover) {
      state.evidence = preserve();
      append(path.join(config.logDirectory, 'alerts.ndjson'), { at: new Date().toISOString(), kind: 'unclean_supervisor_recovery', evidence: state.evidence });
    }
    await start(recover ? 'unclean_recovery' : 'cold_start');
    if (recover) event('restart_gap', { start: previous.lastCheck || previous.startedAt, end: state.startedAt, configHash: verified.configHash, checkpoint: checkpoint(config, verified.ledgerHash), reason: 'unclean_supervisor_recovery' });
    const check = async () => {
      if (closing || ['failed_stopped', 'completed', 'evidence_failed', 'blocked'].includes(state.status)) return;
      const h = await probe(config.workerPort, state.workerPid), pidOk = alive(state.workerPid);
      state.lastCheck = new Date().toISOString();
      if (pidOk && h && !h.error && h.stage !== 'failed') {
        state.failures = 0; state.firstFailureAt = null;
        if (h.done && h.stage === 'finished') { await terminate(); state.status = 'completed'; event('validation_completed'); }
        else state.status = 'active'; save(); return;
      }
      if (pidOk && !h && Date.now() - Date.parse(state.startedAt) < config.startupGraceMs) { save(); return; }
      if (!state.firstFailureAt || Date.now() - Date.parse(state.firstFailureAt) > 300000) { state.failures = 0; state.firstFailureAt = state.lastCheck; }
      state.failures++; state.status = 'interrupted'; save(); event('heartbeat_failed', { pidOk, heartbeatPid: h?.pid, consecutive: state.failures });
      if (state.failures === 1) {
        try { state.evidence = preserve(); append(path.join(config.logDirectory, 'alerts.ndjson'), { at: state.lastCheck, kind: 'validation_failure', evidence: state.evidence }); }
        catch (error) { state.status = 'evidence_failed'; atomic(failureLatch, { at: state.lastCheck, configHash: verified.configHash, reason: state.status }); save(); event('evidence_capture_failed', { message: error.message }); await terminate(); return; }
        save();
      }
      if (config.failurePolicy === 'stop') { await terminate(); state.status = 'failed_stopped'; atomic(failureLatch, { at: state.lastCheck, configHash: verified.configHash, reason: state.status }); save(); event('validation_failed_stopped'); }
      else if (state.failures >= 2) {
        if (!state.evidence) throw Error('EVIDENCE_REQUIRED_BEFORE_RESTART');
        const gapStart = state.firstFailureAt; await terminate(); await start('second_consecutive_failure');
        event('restart_gap', { start: gapStart, end: state.startedAt, configHash: verified.configHash, checkpoint: checkpoint(config, verified.ledgerHash) });
      }
    };
    timer = setInterval(() => {
      if (busy) return; busy = true;
      void check().catch(async error => { state.status = 'blocked'; atomic(failureLatch, { at: new Date().toISOString(), configHash: verified.configHash, reason: error.message }); save(); event('supervisor_error', { message: error.message }); await terminate(); }).catch(error => console.error(error)).finally(() => { busy = false; });
    }, config.intervalMs);
    event('service_started', { ancestry: owners, contract: BASE, synthetic: verified.synthetic });
    const stop = async () => { if (closing) return; closing = true; clearInterval(timer); while (busy) await sleep(25); await terminate(); state.status = 'stopped'; save(); event('service_stopped'); await new Promise(resolve => server.close(resolve)); if (lockOwned) fs.unlinkSync(lock); await new Promise(resolve => mutex.close(resolve)); };
    return { stop, state, check };
  } catch (error) {
    // A failed log/state write after spawn must not leave an untracked writer behind.
    if (worker?.pid && alive(worker.pid)) {
      process.kill(worker.pid, 'SIGTERM'); const deadline = Date.now() + 10000;
      while (alive(worker.pid) && Date.now() < deadline) await sleep(50);
    }
    if (lockOwned && !alive(worker?.pid)) fs.unlinkSync(lock);
    await new Promise(resolve => server.close(resolve)); if (mutex.listening) await new Promise(resolve => mutex.close(resolve)); throw error;
  }
}
module.exports = { run, validate, checkpoint, probe, ancestry, BASE, sha, alive };
if (require.main === module) {
  const config = read(process.argv[2]);
  run(config).then(service => {
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { service.stop().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); }); });
  }).catch(error => {
    try { fs.mkdirSync(config.logDirectory, { recursive: true }); append(path.join(config.logDirectory, 'startup-errors.ndjson'), { at: new Date().toISOString(), kind: 'service_start_failed', error: error.stack }); }
    catch (captureError) { console.error(captureError); }
    console.error(error); process.exitCode = 1;
  });
}
