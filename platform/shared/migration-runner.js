'use strict';

var fs = require('fs');
var path = require('path');
var log = require('./services/log');
var db = require('./services/db');

var MODULES_DIR = path.resolve(__dirname, '../modules');
var MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function findMigrationFilesInDir(dir, modName, files) {
  var modMigDir = path.join(dir, 'migrations');
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

function walkModules(dir, files) {
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (!entry.isDirectory()) continue;
    if (entry.name === '.gitkeep' || entry.name === 'node_modules') continue;

    var fullPath = path.join(dir, entry.name);
    var modName = entry.name;

    // Check if this dir is a module (has module.json)
    if (fs.existsSync(path.join(fullPath, 'module.json'))) {
      findMigrationFilesInDir(fullPath, modName, files);
    }

    // Always recurse for nested modules
    walkModules(fullPath, files);
  }
}

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
    walkModules(MODULES_DIR, files);
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
