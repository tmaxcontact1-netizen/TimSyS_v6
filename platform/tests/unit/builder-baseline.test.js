'use strict';
jest.mock('../../modules/builder/templates', () => ({ seedDefaults: jest.fn() }));
jest.mock('../../shared/registry/componentRegistry', () => ({ getAll: () => [
  {name:'rooms',ownerModule:'room_registry'}, {name:'stuff',ownerModule:'inventory'}, {name:'people',ownerModule:'student_registry'}
] }));
const SQLite = require('better-sqlite3');
const {boot} = require('../../modules/builder');
let db,ctx;
beforeEach(() => {
  db=new SQLite(':memory:');
  db.exec('CREATE TABLE app_module_assignments(app_id TEXT,module_name TEXT,UNIQUE(app_id,module_name)); CREATE TABLE app_component_assignments(app_id TEXT,component_name TEXT,UNIQUE(app_id,component_name));');
  ctx={log:{info:()=>{}},db:{query(sql,args){const s=db.prepare(sql);return s.reader?{rows:s.all(...args)}:s.run(...args);}}};
});
afterEach(()=>db.close());
const names=()=>db.prepare("SELECT module_name FROM app_module_assignments WHERE app_id='principal-ed' ORDER BY module_name").all().map(r=>r.module_name);
test('fresh boot includes people, places, stuff and planning; repeat boot is idempotent',()=>{
  boot(ctx);expect(names()).toEqual(expect.arrayContaining(['student_registry','staff_registry','room_registry','inventory','scheduler','nervous_breakdown']));
  const before=names();boot(ctx);expect(names()).toEqual(before);
});
test('existing optional choices survive while missing required baselines are repaired',()=>{
  db.exec("INSERT INTO app_module_assignments VALUES('principal-ed','tasks'); INSERT INTO app_module_assignments VALUES('other-app','calendar');");
  boot(ctx);expect(names()).toEqual(['inventory','room_registry','tasks']);
  expect(db.prepare("SELECT component_name FROM app_component_assignments ORDER BY component_name").all().map(r=>r.component_name)).toEqual(['rooms','stuff']);
  expect(db.prepare("SELECT module_name FROM app_module_assignments WHERE app_id='other-app'").get().module_name).toBe('calendar');
});
