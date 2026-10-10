import type {Pool,PoolClient} from 'pg';

// A report pins a terminal run. Confirmation never promotes proposals to human decisions.
export async function machineReport(db:Pick<Pool,'query'>|PoolClient,sessionId:string,runId:string){
 const run=(await db.query("SELECT * FROM researched.mcf_ai_runs WHERE id=$1 AND session_id=$2 AND kind='classification' FOR SHARE",[runId,sessionId])).rows[0];
 if(!run||!['completed','partial','cancelled'].includes(run.status))throw Error('finish_analysis_before_confirming');
 const outputs=(await db.query('SELECT * FROM researched.mcf_ai_outputs WHERE run_id=$1 ORDER BY created_at,id',[runId])).rows;
 const proposals=(await db.query('SELECT p.*,o.run_id FROM researched.mcf_ai_proposals p JOIN researched.mcf_ai_outputs o ON o.id=p.output_id WHERE o.run_id=$1 AND p.session_id=$2 ORDER BY p.created_at,p.id',[runId,sessionId])).rows;
 if(!proposals.length)throw Error('no_analysis_findings_to_confirm');
 const tasks=(await db.query('SELECT ordinal,status,error,unit_ids FROM researched.mcf_ai_tasks WHERE run_id=$1 ORDER BY ordinal',[runId])).rows;
 return {run,proposals,outputs,tasks,notice:'AI findings are not human-reviewed decisions. Confirmation saves this report; only explicit researcher edits count as human coding.'};
}
