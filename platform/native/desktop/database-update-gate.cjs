'use strict';
const fs=require('node:fs'),path=require('node:path');
function assertDatabaseIsolationBundle(root){
 let c;try{c=JSON.parse(fs.readFileSync(path.join(root,'native/desktop/database-isolation-contract.json'),'utf8'));}catch{throw Error('DATABASE_ISOLATION_UPDATE_INCOMPATIBLE');}
 if(c.schemaVersion!==1||c.owner!=='timsys'||c.sharedStorage!=='shared-database/postgres'||c.bindingFile!=='database-binding.private.json'||c.legacyFallbackAllowed!==false||JSON.stringify(c.applicationDatabases)!==JSON.stringify(['dressed','researched']))throw Error('DATABASE_ISOLATION_UPDATE_INCOMPATIBLE');
 for(const file of['app-database-gateway.cjs','database-update-gate.cjs'])if(!fs.existsSync(path.join(root,'native/desktop',file)))throw Error('DATABASE_ISOLATION_UPDATE_INCOMPATIBLE');
 const main=fs.readFileSync(path.join(root,'native/desktop/main.cjs'),'utf8');
 if(!main.includes("appDatabase('dressed'")||!main.includes("appDatabase('researched'")||!main.includes('dataRoot: layout.databaseData'))throw Error('DATABASE_ISOLATION_UPDATE_INCOMPATIBLE');
 return true;
}
module.exports={assertDatabaseIsolationBundle};
