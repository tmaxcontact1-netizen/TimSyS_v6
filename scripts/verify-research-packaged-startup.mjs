import {mkdtemp} from 'node:fs/promises';import {resolve,join} from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const [installed,backend,frontend]=process.argv.slice(2);if(!installed||!backend||!frontend)throw Error('Supply installed resources, candidate backend and candidate frontend');
const {LocalPostgresManager,availablePort}=require(installed+'/platform/native/desktop/local-postgres-manager.cjs'),{SupervisedAppManager}=require(installed+'/platform/native/desktop/supervised-app-manager.cjs');
const temp=await mkdtemp(resolve('verification-local/startup-diagnostic/db-')),pg=new LocalPostgresManager({binaryRoot:installed+'/runtime/postgres',dataRoot:temp,infrastructureOnly:true}),manager=new SupervisedAppManager({runtimeExecutable:resolve(installed,'../TimSyS Launcher.exe'),runtimeEnvironment:{ELECTRON_RUN_AS_NODE:'1'}});
manager.on('log',e=>{if(e.level==='error')console.log('Backend error: '+e.message)});
try{const db=await pg.start(),port=await availablePort();const env={...process.env,RESEARCHED_ENV:'production',RESEARCHED_APP_ROOT:backend,RESEARCHED_STORAGE_ROOT:join(temp,'sources'),RESEARCHED_DATABASE_URL:db.migrationUrl,RESEARCHED_PORT:String(port),TIMSYS_DOMAIN_TOKEN:'isolated-startup-probe',TIMSYS_SERVICE_ROOT:backend,TIMSYS_FRONTEND_ROOT:frontend+'/dist/frontend',RESEARCHED_AI_MANAGED:'1',NODE_OPTIONS:'--preserve-symlinks --preserve-symlinks-main'};
for(const k of Object.keys(env))if(/^(RESEARCHED|TIMSYS)_AI_/.test(k)&&k!=='RESEARCHED_AI_MANAGED')delete env[k];
execFileSync(process.execPath,[backend+'/dist/scripts/migrate.js'],{cwd:frontend,env,windowsHide:true,stdio:'pipe'});console.log('PASS isolated packaged migrations');
const status=await manager.start(backend+'/timsys.app.json',env);console.log(JSON.stringify({state:status.state,port,disposableDatabase:true}));const r=await fetch('http://127.0.0.1:'+port+'/');console.log('Frontend HTTP '+r.status);}
catch(e){console.error(e.stderr?.toString()||e.message);process.exitCode=1;}finally{await manager.stopAll();await pg.stop();}

