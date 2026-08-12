const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

function stamp() { return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'); }

async function verifySqlite(file) {
  const handle = await fsp.open(file, 'r');
  try {
    const header = Buffer.alloc(16);
    await handle.read(header, 0, 16, 0);
    if (header.toString('utf8') !== 'SQLite format 3\0') throw new Error('Backup is not a valid SQLite database');
  } finally { await handle.close(); }
}

async function backupPlatformDatabase(dataRoot) {
  const source = path.join(dataRoot, 'platform', 'timsys.sqlite');
  if (!fs.existsSync(source)) return null;
  const destinationRoot = path.join(dataRoot, 'backups', 'platform');
  await fsp.mkdir(destinationRoot, { recursive: true });
  const destination = path.join(destinationRoot, `timsys-${stamp()}.sqlite`);
  await fsp.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
  await verifySqlite(destination);
  const backups = (await fsp.readdir(destinationRoot)).filter((name) => /^timsys-.*\.sqlite$/.test(name)).sort().reverse();
  for (const expired of backups.slice(7)) await fsp.rm(path.join(destinationRoot, expired), { force: true });
  return destination;
}

async function restorePlatformDatabase(dataRoot, backupFile) {
  const resolvedRoot = path.resolve(dataRoot);
  const resolvedBackup = path.resolve(backupFile);
  if (!resolvedBackup.startsWith(path.join(resolvedRoot, 'backups') + path.sep)) throw new Error('Restore source must be inside the TimSyS backup directory');
  await verifySqlite(resolvedBackup);
  const destination = path.join(resolvedRoot, 'platform', 'timsys.sqlite');
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) await fsp.copyFile(destination, destination + `.before-restore-${stamp()}`);
  await fsp.copyFile(resolvedBackup, destination);
  for (const suffix of ['-wal', '-shm']) await fsp.rm(destination + suffix, { force: true });
  return destination;
}

function diagnostics({ layout, statuses = [] }) {
  const exists = (value) => Boolean(value && fs.existsSync(value));
  return Object.freeze({
    generatedAt: new Date().toISOString(), platform: process.platform, architecture: process.arch,
    osRelease: os.release(), electron: process.versions.electron || null, node: process.versions.node,
    runtime: {
      platformDatabasePresent: exists(path.join(layout.platformData, 'timsys.sqlite')),
      postgresClusterPresent: exists(path.join(layout.memecoinedData, 'postgres', 'data', 'PG_VERSION')),
      postgresLogPresent: exists(path.join(layout.memecoinedData, 'postgres', 'postgres.log')),
    },
    apps: statuses.map(({ id, state, detail, processes }) => ({ id, state, detail: detail || null, processCount: Array.isArray(processes) ? processes.length : 0 })),
  });
}

module.exports = { backupPlatformDatabase, restorePlatformDatabase, diagnostics, verifySqlite };
