const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readdir, readFile, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('production Node diagnostic flags create a parseable report and durable fatal log', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'timsys-crash-capture-'));
  const marker = 'TIMSYS_FORCED_CRASH_CAPTURE';
  const result = spawnSync(process.execPath, [
    '--report-on-fatalerror', '--report-uncaught-exception', `--report-directory=${root}`,
    '-e', `throw new Error(${JSON.stringify(marker)})`,
  ], { encoding: 'utf8' });
  const stderrPath = path.join(root, 'worker.stderr.log');
  await writeFile(stderrPath, result.stderr, 'utf8');
  assert.notEqual(result.status, 0);
  assert.match(await readFile(stderrPath, 'utf8'), new RegExp(marker));
  const reports = (await readdir(root)).filter((name) => /^report\..+\.json$/.test(name));
  assert.equal(reports.length, 1);
  const report = JSON.parse(await readFile(path.join(root, reports[0]), 'utf8'));
  assert.equal(report.header.event, 'Exception');
  assert.match(JSON.stringify(report.javascriptStack), new RegExp(marker));
});
