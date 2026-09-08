import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { loadConfig } from "../src/infrastructure/config.js";
const config=loadConfig(process.env), pool=new pg.Pool({connectionString:config.databaseUrl});
try { const directory=resolve(config.appRoot,"migrations"); for(const name of (await readdir(directory)).filter(n=>/^\d+_.+\.sql$/.test(n)).sort()){const version=name.split("_")[0]!;const exists=await pool.query("SELECT to_regclass('researched.schema_migrations') IS NOT NULL AS ready");if(exists.rows[0]?.ready&&(await pool.query("SELECT 1 FROM researched.schema_migrations WHERE version=$1",[version])).rowCount)continue;await pool.query("BEGIN");try{await pool.query(await readFile(resolve(directory,name),"utf8"));await pool.query("INSERT INTO researched.schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",[version]);await pool.query("COMMIT");}catch(error){await pool.query("ROLLBACK");throw error}} } finally { await pool.end(); }
