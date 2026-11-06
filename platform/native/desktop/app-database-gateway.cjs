'use strict';
const fs=require('node:fs'),path=require('node:path');
// TimSyS-side adapter. No TradeEd package import and no schema/database discovery.
function appDatabase(app,shared,dataRoot,{read=file=>fs.readFileSync(file,'utf8')}={}){
 if(!['researched','dressed'].includes(app))throw Error('APP_DATABASE_SCOPE_DENIED');
 const file=path.join(dataRoot,app,'database-binding.private.json');let binding;
 try{binding=JSON.parse(read(file));}catch{throw Error('APP_DATABASE_BINDING_REQUIRED:'+app);}
 const keys=['schemaVersion','appId','database','runtime','runtimePassword'];
 if(!binding||Object.keys(binding).length!==keys.length||keys.some(k=>!Object.hasOwn(binding,k))||binding.schemaVersion!==1||binding.appId!==app||!new RegExp('^'+app+'_isolated_[0-9]{8}$').test(binding.database)||!new RegExp('^'+app+'_runtime_[0-9]{8}$').test(binding.runtime)||!/^[a-f0-9]{64}$/.test(binding.runtimePassword))throw Error('APP_DATABASE_BINDING_DENIED:'+app);
 const migration=new URL(shared.migrationUrl),runtime=new URL(shared.runtimeUrl);
 if(migration.hostname!=='127.0.0.1'||runtime.hostname!=='127.0.0.1'||migration.port!==runtime.port||migration.protocol!=='postgresql:'||runtime.protocol!=='postgresql:')throw Error('APP_DATABASE_HOST_DENIED');
 migration.pathname='/'+binding.database;runtime.pathname='/'+binding.database;runtime.username=binding.runtime;runtime.password=binding.runtimePassword;
 return Object.freeze({...shared,database:binding.database,runtimeUrl:runtime.href,migrationUrl:migration.href});
}
async function grantAppSchemaPrivileges(app,database,{Client}){
 if(!['researched','dressed'].includes(app))throw Error('APP_DATABASE_SCOPE_DENIED');
 const runtime=new URL(database.runtimeUrl),migration=new URL(database.migrationUrl),role=decodeURIComponent(runtime.username);
 if(!new RegExp('^'+app+'_runtime_[0-9]{8}$').test(role)||!new RegExp('^/'+app+'_isolated_[0-9]{8}$').test(runtime.pathname)||migration.pathname!==runtime.pathname||runtime.hostname!=='127.0.0.1'||migration.hostname!=='127.0.0.1'||migration.port!==runtime.port)throw Error('APP_DATABASE_GRANT_SCOPE_DENIED');
 const client=new Client({connectionString:database.migrationUrl,connectionTimeoutMillis:3000,statement_timeout:5000});
 try{await client.connect();await client.query('BEGIN');
  for(const sql of[
   `GRANT USAGE ON SCHEMA "${app}" TO "${role}"`,
   `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA "${app}" TO "${role}"`,
   `GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA "${app}" TO "${role}"`,
   `ALTER DEFAULT PRIVILEGES IN SCHEMA "${app}" GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO "${role}"`,
   `ALTER DEFAULT PRIVILEGES IN SCHEMA "${app}" GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO "${role}"`,
  ])await client.query(sql);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
}
module.exports={appDatabase,grantAppSchemaPrivileges};
