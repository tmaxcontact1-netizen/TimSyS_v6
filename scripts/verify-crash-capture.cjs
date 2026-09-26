const { mkdirSync, readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(process.argv[2] || 'verification/crash-capture');
mkdirSync(root, { recursive: true });
const marker = 'TIMSYS_RELEASE_FORCED_CRASH';
const result = spawnSync(process.execPath, [
  '--report-on-fatalerror', '--report-uncaught-exception', `--report-directory=${root}`,
  '-e', `throw new Error(${JSON.stringify(marker)})`,
], { encoding: 'utf8' });
writeFileSync(join(root, 'worker.stdout.log'), result.stdout || '', 'utf8');
writeFileSync(join(root, 'worker.stderr.log'), result.stderr || '', 'utf8');
const reports = readdirSync(root).filter((name) => /^report\..+\.json$/.test(name));
if (result.status === 0 || reports.length !== 1) throw new Error('Crash capture did not produce exactly one report');
const reportPath = join(root, reports[0]);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (report.header?.event !== 'Exception' || !readFileSync(join(root, 'worker.stderr.log'), 'utf8').includes(marker))
  throw new Error('Crash report or durable stderr is incomplete');
const proof = {
  generatedAt: new Date().toISOString(), node: process.version, exitCode: result.status,
  reportPath, reportEvent: report.header.event, reportTrigger: report.header.trigger,
  stack: report.javascriptStack?.message || report.javascriptStack?.stack?.[0] || null,
  stderrPath: join(root, 'worker.stderr.log'), marker,
};
writeFileSync(join(root, 'proof.json'), `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(proof)}\n`);
