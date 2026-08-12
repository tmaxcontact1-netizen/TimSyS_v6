'use strict';
var fs=require('fs'),path=require('path');

describe('forward migration from the pre-world-model schema',function(){
 var db,dbPath;
 beforeAll(function(){
  dbPath=path.resolve(__dirname,'../helpers/test_migration_upgrade.sqlite');
  [dbPath,dbPath+'-wal',dbPath+'-shm'].forEach(function(file){if(fs.existsSync(file))fs.unlinkSync(file);});
  process.env.DB_PATH=dbPath;jest.resetModules();db=require('../../shared/services/db');var conn=db.getConnection();
  var root=path.resolve(__dirname,'../../migrations');
  ['000_bootstrap','001_initial','002_intelligence','003_rate_limit','004_recommendations','005_route_permissions','006_refresh_tokens','007_builder'].forEach(function(version){
   conn.exec(fs.readFileSync(path.join(root,version+'.sql'),'utf8'));
   conn.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)').run(version,1);
  });
  var moduleMigrations=[['student_registry_001_students','student_registry/migrations/001_students.sql'],['staff_registry_001_staff','staff_registry/migrations/001_staff.sql'],['room_registry_001_rooms','room_registry/migrations/001_rooms.sql'],['inventory_001_inventory','inventory/migrations/001_inventory.sql']];
  moduleMigrations.forEach(function(item){conn.exec(fs.readFileSync(path.resolve(__dirname,'../../modules',item[1]),'utf8'));conn.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)').run(item[0],1);});
  conn.prepare("INSERT INTO students(student_id,first_name,last_name,date_of_birth,sex,enrollment_date) VALUES ('LEGACY-1','Legacy','Student','2012-01-01','Female','2024-01-01')").run();
  conn.prepare('INSERT INTO intelligence_insights(id,scope_type,scope_id,insight_type,summary,metrics_data,trends_data,alerts,generated_at) VALUES (?,?,?,?,?,?,?,?,?)').run('legacy-insight','student','1','general','Legacy insight survives','{}','[]','[]',1000);
 });
 afterAll(function(){if(db)db.close();[dbPath,dbPath+'-wal',dbPath+'-shm'].forEach(function(file){if(fs.existsSync(file))fs.unlinkSync(file);});});
 test('preserves records while upgrading into the canonical schema',function(){
  var runner=require('../../shared/migration-runner');runner.runMigrations();runner.verifyTables();
  expect(db.scalar("SELECT COUNT(*) FROM students WHERE student_id='LEGACY-1'")).toBe(1);
  var migrated=db.query("SELECT * FROM insight_products WHERE id='legacy-insight'").rows[0];expect(migrated.summary).toBe('Legacy insight survives');expect(migrated.provider_id).toBe('legacy.intelligence');
  expect(db.scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='intelligence_insights'")).toBe(0);
  var applied=db.query('SELECT version FROM schema_migrations').rows.map(function(row){return row.version;});expect(new Set(applied).size).toBe(applied.length);expect(applied).toContain('017_cross_component_provider');
 });
});
