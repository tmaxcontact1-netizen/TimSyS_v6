import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { CONTENT_VERSION, type ContentPlan, type ContentResult, type IntakeLink, type LinkObservation } from "../domain/content-analysis.js";

type Database = Pick<Pool, "query" | "connect">;
export class ContentRepository {
  constructor(readonly db: Database) {}
  async transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await this.db.connect();
    try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async list() {
    return (await this.db.query(`SELECT w.id,s.title,w.created_at,w.updated_at,(SELECT count(*)::int FROM researched.content_links WHERE workflow_id=w.id) AS link_count FROM researched.content_workflows w JOIN researched.studies s ON s.id=w.id ORDER BY w.updated_at DESC`)).rows;
  }
  async create(title: string, plan: ContentPlan) {
    const id = randomUUID(), at = new Date().toISOString();
    await this.transaction(async client => {
      await client.query(`INSERT INTO researched.studies(id,title,research_question,methodology,created_at,updated_at) VALUES($1,$2,$3,'Structured content analysis with preserved evidence',$4,$4)`, [id,title,plan.goal,at]);
      await client.query(`INSERT INTO researched.content_workflows VALUES($1,$2,$3,$3)`, [id,JSON.stringify(plan),at]);
      await this.audit(client,id,"created",id,{title,plan});
    });
    return this.get(id);
  }
  async get(id: string) {
    const workflow = (await this.db.query(`SELECT w.*,s.title FROM researched.content_workflows w JOIN researched.studies s ON s.id=w.id WHERE w.id=$1`,[id])).rows[0];
    if (!workflow) return null;
    const [links,runs,documents] = await Promise.all([
      this.db.query(`SELECT * FROM researched.content_links WHERE workflow_id=$1 ORDER BY created_at,url`,[id]),
      this.db.query(`SELECT * FROM researched.content_runs WHERE workflow_id=$1 ORDER BY created_at DESC`,[id]),
      this.db.query(`SELECT id,label,created_at FROM researched.sources WHERE study_id=$1 AND original_url LIKE 'upload://%' ORDER BY created_at`,[id]),
    ]);
    return {...workflow,links:links.rows,runs:runs.rows,documents:documents.rows};
  }
  async importLinks(workflowId: string, links: IntakeLink[], sourceId: string | null) {
    await this.transaction(async client => {
      await client.query("SELECT id FROM researched.content_workflows WHERE id=$1 FOR UPDATE",[workflowId]);
      await this.assertIdle(client,workflowId);
      for (const link of links) await client.query(`INSERT INTO researched.content_links(id,workflow_id,url,occurrences,created_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(workflow_id,url) DO UPDATE SET occurrences=researched.content_links.occurrences || excluded.occurrences`,[randomUUID(),workflowId,link.url,JSON.stringify(link.occurrences.map(x=>({...x,...(sourceId?{sourceDocumentId:sourceId}:{inputMethod:"manual"})})))]);
      await this.audit(client,workflowId,sourceId?"document_imported":"links_entered",sourceId??workflowId,{links:links.length});
    });
  }
  async assertIdle(client: Pick<PoolClient,"query">, workflowId: string) {
    if ((await client.query("SELECT id FROM researched.content_runs WHERE workflow_id=$1 AND status='running'",[workflowId])).rowCount) throw new Error("analysis_already_running");
  }
  async decide(workflowId: string, linkId: string, included: boolean) {
    return this.transaction(async client=>{
      await client.query("SELECT id FROM researched.content_workflows WHERE id=$1 FOR UPDATE",[workflowId]);
      await this.assertIdle(client,workflowId);
      const result=await client.query("UPDATE researched.content_links SET included=$3 WHERE workflow_id=$1 AND id=$2 RETURNING id",[workflowId,linkId,included]);
      if (!result.rowCount) throw new Error("link_not_found");
      await this.audit(client,workflowId,"link_decision",linkId,{included});
      return {included};
    });
  }
  async start(workflowId: string, plan: ContentPlan, retryRunId?: string, selectedLinkIds?:string[]) {
    return this.transaction(async client=>{
      if (!(await client.query("SELECT id FROM researched.content_workflows WHERE id=$1 FOR UPDATE",[workflowId])).rowCount) throw new Error("workflow_not_found");
      await this.assertIdle(client,workflowId);
      if(selectedLinkIds){const valid=(await client.query('SELECT id FROM researched.content_links WHERE workflow_id=$1 AND id=ANY($2::uuid[])',[workflowId,selectedLinkIds])).rows;if(valid.length!==new Set(selectedLinkIds).size)throw Error('invalid_link_selection');}
      const links = selectedLinkIds ? (await client.query('SELECT id FROM researched.content_links WHERE workflow_id=$1 AND id=ANY($2::uuid[])',[workflowId,selectedLinkIds])).rows : retryRunId ? (await client.query(`SELECT l.* FROM researched.content_links l JOIN researched.content_tasks t ON t.link_id=l.id JOIN researched.content_runs r ON r.id=t.run_id WHERE l.workflow_id=$1 AND r.workflow_id=$1 AND t.run_id=$2 AND t.status IN('failed','cancelled') AND l.included`,[workflowId,retryRunId])).rows : (await client.query("SELECT id FROM researched.content_links WHERE workflow_id=$1 AND included",[workflowId])).rows;
      if (!links.length) throw new Error("no_selected_links");
      const id=randomUUID();
      await client.query("INSERT INTO researched.content_runs(id,workflow_id,plan,version,status,created_at) VALUES($1,$2,$3,$4,'running',now())",[id,workflowId,JSON.stringify(plan),CONTENT_VERSION]);
      for(const link of links) await client.query("INSERT INTO researched.content_tasks(id,run_id,link_id,next_attempt_at,updated_at) VALUES($1,$2,$3,now(),now())",[randomUUID(),id,link.id]);
      await client.query("UPDATE researched.content_workflows SET plan=$2,updated_at=now() WHERE id=$1",[workflowId,JSON.stringify(plan)]);
      await this.audit(client,workflowId,"run_started",id,{plan,links:links.length,retryRunId:retryRunId??null});
      return {id};
    });
  }
  async run(id:string) {
    const run=(await this.db.query("SELECT * FROM researched.content_runs WHERE id=$1",[id])).rows[0];
    if(!run)return null;
    const tasks=(await this.db.query(`SELECT t.*,l.url,l.occurrences FROM researched.content_tasks t JOIN researched.content_links l ON l.id=t.link_id WHERE run_id=$1 ORDER BY l.url`,[id])).rows;
    return {...run,tasks};
  }
  async claim() {
    return (await this.db.query(`WITH next AS(SELECT t.id FROM researched.content_tasks t JOIN researched.content_runs r ON r.id=t.run_id WHERE r.status='running' AND t.status IN('queued','retry') AND t.attempts<t.maximum_attempts AND t.next_attempt_at<=now() ORDER BY t.next_attempt_at,t.id FOR UPDATE OF t SKIP LOCKED LIMIT 1) UPDATE researched.content_tasks t SET status='running',attempts=attempts+1,updated_at=now() FROM next WHERE t.id=next.id RETURNING t.*`)).rows[0]??null;
  }
  async context(taskId:string) {
    return (await this.db.query(`SELECT t.*,r.workflow_id,r.plan,l.url,l.occurrences FROM researched.content_tasks t JOIN researched.content_runs r ON r.id=t.run_id JOIN researched.content_links l ON l.id=t.link_id WHERE t.id=$1`,[taskId])).rows[0];
  }
  async active(taskId:string) {return (await this.db.query("SELECT id FROM researched.content_tasks WHERE id=$1 AND status='running'",[taskId])).rowCount===1;}
  async finish(taskId:string, result:ContentResult) {
    await this.db.query("UPDATE researched.content_tasks SET status='completed',result=$2,error=NULL,updated_at=now() WHERE id=$1 AND status='running'",[taskId,JSON.stringify(result)]);
  }
  async fail(taskId:string, observation:LinkObservation, result?:ContentResult) {
    const retry=["temporary_failure","rate_limited","capture_failed"].includes(observation.status);
    await this.db.query(`UPDATE researched.content_tasks SET status=CASE WHEN $3 AND attempts<maximum_attempts THEN 'retry' ELSE 'failed' END,error=$2,result=$4,next_attempt_at=now()+(LEAST(300,5*power(2,attempts-1))||' seconds')::interval,updated_at=now() WHERE id=$1 AND status='running'`,[taskId,JSON.stringify(observation),retry,result?JSON.stringify(result):null]);
  }
  async settle() {
    await this.db.query(`UPDATE researched.content_runs r SET status='completed',completed_at=now() WHERE status='running' AND NOT EXISTS(SELECT 1 FROM researched.content_tasks t WHERE t.run_id=r.id AND t.status IN('queued','running','retry'))`);
  }
  async cancel(runId:string) {
    return this.transaction(async client=>{
      const run=(await client.query("UPDATE researched.content_runs SET status='cancelled',completed_at=now() WHERE id=$1 AND status='running' RETURNING workflow_id",[runId])).rows[0];
      if(!run)throw new Error("run_not_active");
      await client.query("UPDATE researched.content_tasks SET status='cancelled',updated_at=now() WHERE run_id=$1 AND status IN('queued','running','retry')",[runId]);
      await this.audit(client,run.workflow_id,"run_cancelled",runId,{});
      return {cancelled:true};
    });
  }
  async recover() {
    await this.db.query(`UPDATE researched.content_tasks SET status=CASE WHEN attempts<maximum_attempts THEN 'retry' ELSE 'failed' END,next_attempt_at=now(),updated_at=now(),error='{"status":"interrupted","detail":"Application restarted during capture"}' WHERE status='running'`);
    await this.settle();
  }
  async source(workflowId:string,url:string,label:string) {
    return (await this.db.query(`INSERT INTO researched.sources(id,study_id,label,original_url,source_type,corpus_status,authority,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'included','unknown',now(),now()) ON CONFLICT(study_id,original_url) DO UPDATE SET updated_at=now() RETURNING *`,[randomUUID(),workflowId,label,url,/\.pdf(?:$|\?)/i.test(url)?"pdf":/\.docx(?:$|\?)/i.test(url)?"document":"webpage"])).rows[0];
  }
  async audit(client:Pick<PoolClient,"query">,studyId:string,action:string,id:string,value:unknown) {
    await client.query("INSERT INTO researched.audit_events(id,study_id,entity_kind,entity_id,action,actor,occurred_at,after_value) VALUES($1,$2,'content_analysis',$3,$4,'local-researcher',now(),$5)",[randomUUID(),studyId,id,action,JSON.stringify(value)]);
  }
}
