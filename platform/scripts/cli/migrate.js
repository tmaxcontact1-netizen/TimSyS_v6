#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const PLATFORM_ROOT = path.resolve(__dirname, '../..');
const configuredDbPath = process.env.DB_PATH;
const DB_PATH = configuredDbPath
  ? (path.isAbsolute(configuredDbPath) ? configuredDbPath : path.resolve(PLATFORM_ROOT, configuredDbPath))
  : path.join(PLATFORM_ROOT, 'data', 'timsys.sqlite');
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const MODULES_DIR = path.resolve(__dirname, '../../modules');

function findMigrationFiles() {
  const files = [];
  if (fs.existsSync(MIGRATIONS_DIR)) {
    for (const f of fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort())
      files.push({ version: f.replace('.sql', ''), file: f, filePath: path.join(MIGRATIONS_DIR, f), module: null });
  }
  if (fs.existsSync(MODULES_DIR)) {
    for (const modName of fs.readdirSync(MODULES_DIR).filter(d => fs.statSync(path.join(MODULES_DIR, d)).isDirectory())) {
      const modMigDir = path.join(MODULES_DIR, modName, 'migrations');
      if (fs.existsSync(modMigDir))
        for (const f of fs.readdirSync(modMigDir).filter(f => f.endsWith('.sql')).sort())
          files.push({ version: `${modName}_${f.replace('.sql', '')}`, file: f, filePath: path.join(modMigDir, f), module: modName });
    }
  }
  files.sort((a, b) => a.version === '000_bootstrap' ? -1 : b.version === '000_bootstrap' ? 1 : a.version.localeCompare(b.version));
  return files;
}

function getAppliedMigrations(db) {
  try {
    const rows = db.prepare('SELECT version FROM schema_migrations').all();
    return new Set(rows.map(r => r.version));
  } catch {
    return new Set();
  }
}

function listMigrations() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  const migrations = findMigrationFiles();
  const applied = getAppliedMigrations(db);
  db.close();
  console.log('\nMigration Status:\n------------------\n');
  for (const m of migrations) console.log(`${applied.has(m.version) ? '[APPLIED]' : '[PENDING]'} ${m.version}${m.module ? ` (${m.module})` : ''}`);
  console.log(`\nTotal: ${migrations.length} | Applied: ${applied.size} | Pending: ${migrations.length - applied.size}\n`);
}

function runSingleMigration(version) {
  const migration = findMigrationFiles().find(m => m.version === version);
  if (!migration) { console.error(`Error: Migration '${version}' not found.`); process.exit(1); }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const applied = getAppliedMigrations(db);
  if (applied.has(migration.version)) { console.log(`Already applied: ${version}`); db.close(); return; }
  const sql = fs.readFileSync(migration.filePath, 'utf8');
  try {
    db.exec('BEGIN TRANSACTION');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(migration.version, Date.now());
    db.exec('COMMIT');
    console.log(`OK: ${version}`);
  } catch (err) { try { db.exec('ROLLBACK'); } catch {} console.error(`FAIL: ${err.message}`); process.exit(1); }
  finally { db.close(); }
}

function rollbackMigration(version) {
  const migration = findMigrationFiles().find(m => m.version === version);
  if (!migration) { console.error(`Error: Migration '${version}' not found.`); process.exit(1); }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const applied = getAppliedMigrations(db);
  if (!applied.has(migration.version)) { console.log(`Not applied: ${version}`); db.close(); return; }
  const sql = fs.readFileSync(migration.filePath, 'utf8');
  const dropStatements = sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--') && (l.toUpperCase().includes('DROP TABLE') || l.toUpperCase().includes('DROP INDEX')));
  console.log(`Rolling back: ${version}`);
  try {
    db.exec('BEGIN TRANSACTION');
    for (const stmt of dropStatements) try { db.exec(stmt); } catch {}
    db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(version);
    db.exec('COMMIT');
    console.log(`OK: Rolled back ${version}`);
  } catch (err) { try { db.exec('ROLLBACK'); } catch {} console.error(`FAIL: ${err.message}`); process.exit(1); }
  finally { db.close(); }
}

function main() {
  const cmd = process.argv[2];
  if (!cmd) { console.log('Usage: node scripts/cli/migrate.js <list|run|rollback> [version]'); process.exit(0); }
  if (cmd === 'list') listMigrations();
  else if (cmd === 'run') runSingleMigration(process.argv[3]);
  else if (cmd === 'rollback') rollbackMigration(process.argv[3]);
  else { console.error(`Unknown: ${cmd}`); process.exit(1); }
}
main();
