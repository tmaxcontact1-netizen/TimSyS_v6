import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Timestamp } from "../../domain/shared/types.js";

interface DatabasePort { connect(): Promise<Pick<PoolClient, "query" | "release">>; }

export class PostgresOperatorRuntimeControl {
  public constructor(private readonly database: DatabasePort) {}

  public async entryBlocked(): Promise<boolean> {
    const client = await this.database.connect();
    try {
      const result = await client.query<{ entry_blocked: boolean }>(
        "SELECT entry_blocked FROM operator_runtime_control WHERE singleton=true",
      );
      return result.rows[0]?.entry_blocked ?? false;
    } finally { client.release(); }
  }

  public async stop(actorId: string, at: Timestamp): Promise<string> {
    const reason = "Emergency stop requested by operator";
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO operator_runtime_control
          (singleton,entry_blocked,reason,changed_by,changed_at)
         VALUES (true,true,$1,$2,$3)
         ON CONFLICT (singleton) DO UPDATE SET entry_blocked=true,reason=$1,
           changed_by=$2,changed_at=$3,version=operator_runtime_control.version+1`,
        [reason, actorId, at],
      );
      await client.query(
        `INSERT INTO operator_runtime_control_events
          (id,entry_blocked,reason,actor_id,occurred_at,content_hash)
         VALUES ($1,true,$2,$3,$4,$5)`,
        [randomUUID(), reason, actorId, at,
          createHash("sha256").update(["stop", actorId, at, reason].join("\0")).digest("hex")],
      );
      await client.query("COMMIT");
      return "Emergency stop active. New entries are blocked; position monitoring and exits continue.";
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally { client.release(); }
  }
}
