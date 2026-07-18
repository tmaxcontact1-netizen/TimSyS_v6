#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/timsys.sqlite';
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const MODULES_DIR = path.resolve(__dirname, '../../modules');

let conn = null;

function openDb() {
  if (conn) return conn;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('busy_timeout = 5000');
  return conn;
}

function closeDb() {
  if (conn) { conn.close(); conn = null; }
}

function findMigrationFiles() {
  const files = [];
  
  if (fs.existsSync(MIGRATIONS_DIR)) {
    const platformFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const f of platformFiles) {
      files.push({
        version: f.replace('.sql', ''),
        file: f,
        filePath: path.join(MIGRATIONS_DIR, f),
        module: null
      });
    }
  }
  
  if (fs.existsSync(MODULES_DIR)) {
    const moduleDirs = fs.readdirSync(MODULES_DIR)
      .filter(d => fs.statSync(path.join(MODULES_DIR, d)).isDirectory());
    
    for (const modName of moduleDirs) {
      const modMigDir = path.join(MODULES_DIR, modName, 'migrations');
      if (fs.existsSync(modMigDir)) {
        const modFiles = fs.readdirSync(modMigDir)
          .filter(f => f.endsWith('.sql'))
          .sort();
        
        for (const f of modFiles) {
          files.push({
            version: `${modName}_${f.replace('.sql', '')}`,
            file: f,
            filePath: path.join(modMigDir, f),
            module: modName
          });
        }
      }
    }
  }
  
  files.sort((a, b) => {
    if (a.version === '000_bootstrap') return -1;
    if (b.version === '000_bootstrap') return 1;
    return a.version.localeCompare(b.version);
  });
  
  return files;
}

function getAppliedMigrations() {
  const db = openDb();
  try {
    const stmt = db.prepare('SELECT version FROM schema_migrations');
    const rows = stmt.all();
    return new Set(rows.map(r => r.version));
  } catch {
    return new Set();
  } finally {
    closeDb();
  }
}

function listMigrations() {
  const migrations = findMigrationFiles();
  const applied = getAppliedMigrations();
  
  console.log('\nMigration Status:');
  console.log('─────────────────\n');
  
  for (const m of migrations) {
    const status = applied.has(m.version) ? '✅' : '❌';
    const moduleInfo = m.module ? ` (${m.module})` : '(platform)';
    console.log(`${status} ${m.version}${moduleInfo}`);
  }
  
  console.log(`\nTotal: ${migrations.length} | Applied: ${applied.size} | Pending: ${migrations.length - applied.size}\n`);
}

function runSingleMigration(version) {
  const migrations = findMigrationFiles();
  const migration = migrations.find(m => m.version === version);
  
  if (!migration) {
    console.error(`Error: Migration '${version}' not found.`);
    closeDb();
    process.exit(1);
  }
  
  const db = openDb();
  const applied = getAppliedMigrations();
  
  if (applied.has(migration.version)) {
    console.log(`Migration '${version}' already applied.`);
    closeDb();
    return;
  }
  
  const sql = fs.readFileSync(migration.filePath, 'utf8');
  
  console.log(`Applying migration: ${migration.version}${migration.module ? ` (${migration.module})` : ''}`);
  
  try {
    db.exec('BEGIN TRANSACTION');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      Date.now()
    );
    db.exec('COMMIT');
    console.log(`✅ Migration '${version}' applied successfully.`);
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error(`❌ Migration failed: ${err.message}`);
    closeDb();
    process.exit(1);
  } finally {
    closeDb();
  }
}

function rollbackMigration(version) {
  // NOTE: Rollback requires migration to include DROP/ALTER statements
  const migrations = findMigrationFiles();
  const migration = migrations.find(m => m.version === version);
  
  if (!migration) {
    console.error(`Error: Migration '${version}' not found.`);
    closeDb();
    process.exit(1);
  }
  
  const db = openDb();
  const applied = getAppliedMigrations();
  
  if (!applied.has(migration.version)) {
    console.log(`Migration '${version}' not applied. Nothing to rollback.`);
    closeDb();
    return;
  }
  
  const sql = fs.readFileSync(migration.filePath, 'utf8');
  const lines = sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
  const dropStatements = lines.filter(l => 
    l.trim().toUpperCase().includes('DROP TABLE') || 
    l.trim().toUpperCase().includes('DROP INDEX')
  );
  
  console.log(`Rolling back migration: ${migration.version}`);
  
  if (dropStatements.length === 0) {
    console.warn('⚠️  Warning: No DROP statements found in migration. Manual cleanup may be required.');
  }
  
  try {
    db.exec('BEGIN TRANSACTION');
    for (const stmt of dropStatements) {
      try { db.exec(stmt); } catch (e) { /* Ignore if doesn't exist */ }
    }
    db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
    db.exec('COMMIT');
    console.log(`✅ Migration '${version}' rolled back.`);
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error(`❌ Rollback failed: ${err.message}`);
    closeDb();
    process.exit(1);
  } finally {
    closeDb();
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: node scripts/cli/migrate.js <command> [version]\n');
    console.log('Commands:');
    console.log('  list              List all migrations and their status');
    console.log('  run <version>     Run a specific migration');
    console.log('  rollback <version> Rollback a specific migration');
    process.exit(0);
  }
  
  switch (command) {
    case 'list':
      listMigrations();
      break;
    case 'run':
      if (!args[1]) {
        console.error('Error: Version argument required. Usage: node scripts/cli/migrate.js run <version>');
        process.exit(1);
      }
      runSingleMigration(args[1]);
      break;
    case 'rollback':
      if (!args[1]) {
        console.error('Error: Version argument required. Usage: node scripts/cli/migrate.js rollback <version>');
        process.exit(1);
      }
      rollbackMigration(args[1]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();