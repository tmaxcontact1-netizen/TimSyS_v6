'use strict';

const fs = require('fs');
const path = require('path');

const db = require('./services/db');
const log = require('./services/log');

const ROOT_MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');
const MODULES_DIR = path.resolve(process.cwd(), 'modules');

async function runMigrations() {
  const migrations = [];

  if (fs.existsSync(ROOT_MIGRATIONS_DIR)) {
    const entries = fs.readdirSync(ROOT_MIGRATIONS_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.sql'))
      .map((e) => ({
        version: e.name.replace('.sql', ''),
        file: e.name,
        dir: ROOT_MIGRATIONS_DIR,
        isBootstrap: e.name.startsWith('000_'),
      }));
    migrations.push(...entries);
  }

  if (fs.existsSync(MODULES_DIR)) {
    const moduleDirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory());

    for (const modDir of moduleDirs) {
      const modMigrationsDir = path.join(MODULES_DIR, modDir.name, 'migrations');
      if (!fs.existsSync(modMigrationsDir)) continue;

      const entries = fs.readdirSync(modMigrationsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.sql'))
        .map((e) => ({
          version: modDir.name + '_' + e.name.replace('.sql', ''),
          file: e.name,
          dir: modMigrationsDir,
          isBootstrap: false,
          moduleName: modDir.name,
        }));
      migrations.push(...entries);
    }
  }

  migrations.sort((a, b) => {
    if (a.isBootstrap && !b.isBootstrap) return -1;
    if (!a.isBootstrap && b.isBootstrap) return 1;
    return a.version.localeCompare(b.version);
  });

  log.info('Found ' + migrations.length + ' migration file(s)', { count: migrations.length });

  const applied = [];
  let tableExists = false;

  try {
    const result = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
    );
    tableExists = result.rows.length > 0;
  } catch (err) {
    tableExists = false;
  }

  for (const migration of migrations) {
    const version = migration.version;
    const file = migration.file;
    const dir = migration.dir;
    const isBootstrap = migration.isBootstrap;

    // Check if already applied — only skip for bootstrap when table doesn't exist yet
    if (tableExists) {
      try {
        const existing = db.query(
          'SELECT version FROM schema_migrations WHERE version = ?',
          [version]
        );
        if (existing.rows.length > 0) {
          continue;
        }
      } catch (err) {
        throw new Error('Failed to check migration ' + version + ': ' + err.message);
      }
    }

    const sqlPath = path.join(dir, file);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    log.info('Applying migration ' + version, { version: version, file: file });

    try {
      db.transaction(function(tx) {
        const statements = sql.split(';').filter(function(s) { return s.trim().length > 0; });
        for (const stmt of statements) {
          tx.query(stmt);
        }

        tx.query(
          'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
          [version, Date.now()]
        );
      });

      applied.push(version);

      if (isBootstrap) {
        tableExists = true;
      }

      log.info('Migration ' + version + ' applied successfully', { version: version });
    } catch (err) {
      log.error('Migration ' + version + ' failed', { version: version, error: err.message });
      throw new Error('Migration ' + version + ' failed: ' + err.message);
    }
  }

  log.info('Applied ' + applied.length + ' new migration(s)', { versions: applied });
  return applied;
}

function verifyTables() {
  const expectedTables = [
    'schema_migrations',
    'sessions',
    'audit_log',
    'metrics',
    'token_revocation',
    'module_registry',
    'schema_registry',
    'route_registry',
    'function_registry',
    'capability_registry',
    'users',
  ];

  const actualTables = db.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).rows.map(function(r) { return r.name; });

  const missing = expectedTables.filter(function(t) { return !actualTables.includes(t); });

  if (missing.length > 0) {
    throw new Error('Missing tables after migrations: ' + missing.join(', '));
  }

  log.info('Table verification passed', { tables: actualTables.length });
  return true;
}

module.exports = { runMigrations, verifyTables };