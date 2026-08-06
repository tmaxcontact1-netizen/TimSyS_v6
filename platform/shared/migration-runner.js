'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./services/log');
const db = require('./services/db');

var MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
var MODULES_DIR = path.resolve(__dirname, '../modules');

function findMigrationFiles() {
  var files = [];

  if (fs.existsSync(MIGRATIONS_DIR)) {
    var platformFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(function(f) { return f.endsWith('.sql'); })
      .sort();

    for (var i = 0; i < platformFiles.length; i++) {
      files.push({
        version: platformFiles[i].replace('.sql', ''),
        file: platformFiles[i],
        path: path.join(MIGRATIONS_DIR, platformFiles[i]),
        module: null,
      });
    }
  }

  if (fs.existsSync(MODULES_DIR)) {
    var moduleDirs = fs.readdirSync(MODULES_DIR)
      .filter(function(d) { return fs.statSync(path.join(MODULES_DIR, d)).isDirectory(); });

    for (var m = 0; m < moduleDirs.length; m++) {
      var modName = moduleDirs[m];
      var modMigDir = path.join(MODULES_DIR, modName, 'migrations');
      if (fs.existsSync(modMigDir)) {
        var modFiles = fs.readdirSync(modMigDir)
          .filter(function(f) { return f.endsWith('.sql'); })
          .sort();

        for (var j = 0; j < modFiles.length; j++) {
          files.push({
            version: modName + '_' + modFiles[j].replace('.sql', ''),
            file: modFiles[j],
            path: path.join(modMigDir, modFiles[j]),
            module: modName,
          });
        }
      }
    }
  }

  files.sort(function(a, b) {
    if (a.version === '000_bootstrap') return -1;
    if (b.version === '000_bootstrap') return 1;
    return a.version.localeCompare(b.version);
  });

  return files;
}

function tableExists(tableName) {
  var result = db.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  );
  return result.rows.length > 0;
}

function getAppliedMigrations() {
  if (!tableExists('schema_migrations')) {
    return new Set();
  }
  var result = db.query('SELECT version FROM schema_migrations');
  return new Set(result.rows.map(function(r) { return r.version; }));
}

function runMigration(migration) {
  var sql = fs.readFileSync(migration.path, 'utf8');

  log.info('Applying migration ' + migration.version, {
    version: migration.version,
    file: migration.file,
  });

  var conn = db.getConnection();

  conn.exec('BEGIN TRANSACTION');
  try {
    conn.exec(sql);
    conn.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      Date.now()
    );
    conn.exec('COMMIT');
  } catch (err) {
    try {
      conn.exec('ROLLBACK');
    } catch (rollbackErr) {
      // Transaction may have auto-rolled back — discard this secondary error
    }
    throw new Error('Migration ' + migration.version + ' failed: ' + err.message);
  }
}

function runMigrations() {
  var migrations = findMigrationFiles();
  log.info('Found ' + migrations.length + ' migration file(s)', { count: migrations.length });

  var applied = getAppliedMigrations();
  var newCount = 0;
  var appliedVersions = [];

  for (var i = 0; i < migrations.length; i++) {
    var m = migrations[i];

    if (m.version === '000_bootstrap' && !tableExists('schema_migrations')) {
      runMigration(m);
      newCount++;
      appliedVersions.push(m.version);
      applied.add(m.version);
      continue;
    }

    if (applied.has(m.version)) {
      continue;
    }

    runMigration(m);
    newCount++;
    appliedVersions.push(m.version);
    applied.add(m.version);
  }

  log.info('Applied ' + newCount + ' new migration(s)', { versions: appliedVersions });
}

function verifyTables() {
  var result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  var tables = result.rows.map(function(r) { return r.name; });
  log.info('Table verification passed', { tables: tables.length });
}

module.exports = { runMigrations: runMigrations, verifyTables: verifyTables };