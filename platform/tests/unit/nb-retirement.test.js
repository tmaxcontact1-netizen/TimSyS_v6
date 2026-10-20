'use strict';
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../../modules/nervous_breakdown');
const original = fs.readFileSync(path.join(dir, 'migrations/001_responsibility_network.sql'), 'utf8');
const retirement = fs.readFileSync(path.join(dir, 'migrations/002_retire_empty_model.sql'), 'utf8');
function shared(db) {
  db.exec(`CREATE TABLE schema_registry(owner_module TEXT);
    CREATE TABLE function_registry(module_name TEXT,name TEXT);
    CREATE TABLE capability_registry(module_name TEXT);
    CREATE TABLE route_registry(module_name TEXT,handler TEXT);
    CREATE TABLE app_component_assignments(component_name TEXT);
    CREATE TABLE component_registry(owner_module TEXT);
    CREATE TABLE module_registry(name TEXT,metadata TEXT);
    CREATE TABLE metrics(tags TEXT);
    CREATE TABLE metric_points(metric_id TEXT);
    CREATE TABLE metric_definitions(id TEXT);
    CREATE TABLE provider_runs(output_summary TEXT);
    INSERT INTO metrics VALUES('module=nervous_breakdown'),('module=execution');
    INSERT INTO provider_runs VALUES('{"components":{"nervous_breakdown":{"records":0},"execution":{"records":4}}}');`);
}

test('retirement removes the empty schema and preserves unrelated records', () => {
  const db = new Database(':memory:');
  try {
    db.exec(original);
    shared(db);
    db.exec("CREATE TABLE shared_people(id TEXT); INSERT INTO shared_people VALUES('preserved')");
    db.transaction(() => db.exec(retirement))();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'nb_%'").all()).toEqual([]);
    expect(db.prepare('SELECT * FROM shared_people').all()).toEqual([{id:'preserved'}]);
    expect(db.prepare('SELECT * FROM metrics').all()).toEqual([{tags:'module=execution'}]);
    expect(JSON.parse(db.prepare('SELECT output_summary FROM provider_runs').get().output_summary))
      .toEqual({components:{execution:{records:4}}});
    expect(db.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
  } finally { db.close(); }
});

test('retirement refuses an installation whose records have not been audited and cleared', () => {
  const db = new Database(':memory:');
  try {
    db.exec(original);
    // Isolated migration sentinel, not an imported responsibility or JD.
    db.prepare('INSERT INTO nb_records(id,kind,revision,data_json) VALUES(?,?,?,?)')
      .run('retirement-sentinel','role',1,'{}');
    expect(() => db.transaction(() => db.exec(retirement))()).toThrow();
    expect(db.prepare('SELECT COUNT(*) n FROM nb_records').get().n).toBe(1);
  } finally { db.close(); }
});

test('retired model stays absent; replacement exposes only read-only documentary navigation', () => {
  const manifest = require('../../modules/nervous_breakdown/module.json');
  expect(manifest.routes).toHaveLength(3);
  expect(manifest.routes.every(route => route.method === 'GET' && route.auth_required)).toBe(true);
  expect(manifest.routes.every(route => route.path.startsWith('/nervous-breakdown/collections'))).toBe(true);
  expect(manifest.provides).toEqual([]);
  expect(manifest.schema.tables).toEqual([]);
  expect(fs.existsSync(path.join(dir,'component.json'))).toBe(false);
  expect(Object.keys(require('../../modules/nervous_breakdown')).sort()).toEqual(['boot','collections','landscape','source','teardown']);
});
