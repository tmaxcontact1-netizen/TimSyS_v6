'use strict';
// Produces a sealed deployment and disabled task definition; never registers or starts it.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
function taskXml({ executable, serviceFile, configFile, account, enabled = false }) {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
 <RegistrationInfo><Description>TimSyS-owned Q35 validation service. Separate live activation approval required.</Description></RegistrationInfo>
 <Triggers><BootTrigger><Enabled>true</Enabled><Delay>PT30S</Delay></BootTrigger></Triggers>
 <Principals><Principal id="ServiceAccount"><UserId>${xml(account)}</UserId><LogonType>Password</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
 <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable><AllowHardTerminate>true</AllowHardTerminate><Enabled>${enabled}</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure></Settings>
 <Actions Context="ServiceAccount"><Exec><Command>${xml(executable)}</Command><Arguments>&quot;${xml(serviceFile)}&quot; &quot;${xml(configFile)}&quot;</Arguments><WorkingDirectory>${xml(path.dirname(serviceFile))}</WorkingDirectory></Exec></Actions>
</Task>`;
}
function prepare(options) {
  const root = path.resolve(options.destination);
  if (fs.existsSync(root)) throw Error('FRESH_DEPLOYMENT_DIRECTORY_REQUIRED');
  if (!path.isAbsolute(options.nodeExecutable) || !path.isAbsolute(options.decimalDirectory)) throw Error('EXPLICIT_DEPENDENCIES_REQUIRED');
  if (JSON.parse(fs.readFileSync(path.join(options.decimalDirectory, 'package.json'))).version !== '10.6.0') throw Error('PINNED_DECIMAL_REQUIRED');
  fs.mkdirSync(root, { recursive: true });
  const deployment = path.join(root, 'deployment'), runtime = path.join(deployment, 'runtime');
  fs.cpSync(path.join(__dirname, 'runtime'), runtime, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'service.cjs'), path.join(deployment, 'service.cjs'));
  fs.cpSync(fs.realpathSync(options.decimalDirectory), path.join(runtime, 'node_modules', 'decimal.js'), { recursive: true, dereference: true });
  const node = path.join(deployment, path.basename(options.nodeExecutable)); fs.copyFileSync(options.nodeExecutable, node);
  const privateRoot = path.join(root, 'private'); fs.mkdirSync(privateRoot);
  const tokenFile = path.join(privateRoot, 'service-token.txt'); fs.writeFileSync(tokenFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  const jobFile = path.join(privateRoot, 'job.json');
  if (options.fixture) {
    const modelRoot = path.join(privateRoot, 'models'); fs.cpSync(path.join(__dirname, 'models'), modelRoot, { recursive: true });
    const models = { q35: path.join(modelRoot, 'q35-T2026-fit.json'), linear: path.join(modelRoot, 'linear-T2026-fit.json') };
    const job = require(path.join(runtime, 'q35-prospective-fixture.cjs')).fixtures(privateRoot, models);
    job.syntheticPauseAfterEvents = 436; job.syntheticPauseMs = 30000;
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  } else {
    if (!options.jobFile) throw Error('EXPLICIT_CONTINUATION_JOB_REQUIRED');
    // Keep predecessor/scientific configuration intact. Relocation uses its existing continuation checks.
    fs.copyFileSync(options.jobFile, jobFile);
  }
  const inventory = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name); if (e.isSymbolicLink()) throw Error('DEPLOYMENT_SYMLINK_FORBIDDEN');
    return e.isDirectory() ? inventory(file) : [{ file, sha256: sha(fs.readFileSync(file)) }];
  });
  const config = { schemaVersion: 1, serviceId: 'tradeed-q35', runtimeDirectory: runtime,
    executable: node, jobFile, tokenFile, activationFile: path.join(privateRoot, 'activation-NOT-AUTHORIZED.json'),
    dataDirectory: options.dataDirectory || path.join(root, 'data'), logDirectory: options.logDirectory || path.join(root, 'logs'),
    port: options.port, workerPort: options.workerPort, intervalMs: options.fixture ? 500 : 30000,
    startupGraceMs: options.fixture ? 10000 : 60000, failurePolicy: options.failurePolicy || 'stop', recoveryPolicy: options.recoveryPolicy || (options.fixture ? 'resume' : 'review'),
    seals: [...inventory(deployment), ...inventory(privateRoot).filter(s => s.file !== tokenFile)] };
  const configFile = path.join(privateRoot, 'service.json'); fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(root, 'task-DISABLED.xml'), '\ufeff' + taskXml({ executable: node, serviceFile: path.join(deployment, 'service.cjs'), configFile, account: options.account || 'TradeEdSvc' }), 'utf16le');
  fs.writeFileSync(path.join(root, 'deployment-receipt.json'), JSON.stringify({ preparedAt: new Date().toISOString(), fixture: !!options.fixture, configHash: sha(JSON.stringify(config)), activated: false, taskRegistered: false, configFile }, null, 2));
  return { root, config, configFile, serviceFile: path.join(deployment, 'service.cjs') };
}
module.exports = { prepare, taskXml };
if (require.main === module) console.log(JSON.stringify(prepare(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2));
