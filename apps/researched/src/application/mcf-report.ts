import {runEvidence} from './mcf-coverage.js';
import type {Pool,PoolClient} from 'pg';

// A report pins a terminal run. Confirmation never promotes proposals to human decisions.
export async function machineReport(db:Pick<Pool,'query'>|PoolClient,sessionId:string,runId:string){
 const run=(await db.query("SELECT * FROM researched.mcf_ai_runs WHERE id=$1 AND session_id=$2 AND kind='classification' FOR SHARE",[runId,sessionId])).rows[0];
 if(!run||!['completed','partial','cancelled','failed'].includes(run.status))throw Error('finish_analysis_before_confirming');
 const outputs=(await db.query('SELECT * FROM researched.mcf_ai_outputs WHERE run_id=$1 ORDER BY created_at,id',[runId])).rows;

 const evidence=await runEvidence(db,sessionId,runId);if(!evidence.coverage.substantivePopulationUnits)throw Error('no_analysis_findings_to_confirm');return {run:{...run,legacyAuditOnly:run.configuration?.semanticProtocol!==2},outputs,...evidence,notice:'AI findings are not human-reviewed decisions. Confirmation saves this report; only explicit researcher edits count as human coding.'};
}
