import type {Pool,PoolClient} from 'pg';
import {semanticCoverage} from '../domain/mcf-coverage.js';
export async function runEvidence(db:Pick<Pool,'query'>|PoolClient,sessionId:string,runId:string|null){
 if(runId&&!(await db.query("SELECT r.id FROM researched.mcf_ai_runs r JOIN researched.mcf_sessions s ON s.id=$2 WHERE r.id=$1 AND r.kind='classification' AND (r.session_id=s.id OR (r.session_id::text=s.configuration->>'draftSessionId' AND r.id::text=s.configuration->>'machineRunId'))",[runId,sessionId])).rowCount)runId=null;
 const units=(await db.query('SELECT u.*,EXISTS(SELECT 1 FROM researched.mcf_decisions d WHERE d.session_id=su.session_id AND d.unit_id=u.id) AS reviewed FROM researched.mcf_session_units su JOIN researched.mcf_units u ON u.id=su.unit_id WHERE su.session_id=$1 ORDER BY su.ordinal',[sessionId])).rows;
 const proposals=runId?(await db.query('SELECT p.*,o.run_id FROM researched.mcf_ai_proposals p JOIN researched.mcf_ai_outputs o ON o.id=p.output_id WHERE o.run_id=$1 ORDER BY p.created_at,p.id',[runId])).rows:[];
 const candidates=runId?(await db.query('SELECT * FROM researched.mcf_deterministic_candidates WHERE run_id=$1 ORDER BY unit_id',[runId])).rows:[];
 const tasks=runId?(await db.query('SELECT id,ordinal,status,error,unit_ids FROM researched.mcf_ai_tasks WHERE run_id=$1 ORDER BY ordinal',[runId])).rows:[];
 const attempts=runId?(await db.query('SELECT a.* FROM researched.mcf_semantic_attempts a JOIN researched.mcf_ai_tasks t ON t.id=a.task_id WHERE t.run_id=$1 ORDER BY a.started_at,a.id',[runId])).rows:[];
 return {proposals,candidates,tasks,attempts,coverage:semanticCoverage(units,proposals,candidates,tasks,units.filter(u=>u.reviewed).map(u=>u.id))};
}
