import type { PoolClient } from "pg";
import type {
  AcquisitionCycleSummary,
  AcquisitionLease,
  AcquisitionSchedule,
  AcquisitionStage,
} from "../../application/services/acquisition-schedule.js";
import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}
const scheduleId = "00000000-0000-5000-a000-000000000036";

export class PostgresAcquisitionSchedule implements AcquisitionSchedule {
  public constructor(private readonly database: DatabasePort) {}
  public async claim(input: {
    ownerId: string;
    now: Timestamp;
    leaseExpiresAt: Timestamp;
  }): Promise<AcquisitionLease | null> {
    if (input.ownerId.trim().length === 0)
      throw new TypeError("Acquisition lease owner is required");
    if (input.leaseExpiresAt <= input.now)
      throw new RangeError("Acquisition lease must expire in the future");
    const client = await this.database.connect();
    try {
      const result = await client.query<{ started_at: string }>(
        `UPDATE jobs SET state='leased',lease_owner=$2,lease_expires_at=$3,attempts=attempts+1,
                         updated_at=$1,version=version+1
         WHERE id=$4 AND job_type='candidate_acquisition'
           AND ((state='available' AND available_at<=$1) OR (state='leased' AND lease_expires_at<=$1))
         RETURNING updated_at AS started_at`,
        [input.now, input.ownerId, input.leaseExpiresAt, scheduleId],
      );
      const row = result.rows[0];
      return row === undefined
        ? null
        : Object.freeze({ ownerId: input.ownerId, startedAt: asTimestamp(row.started_at) });
    } finally {
      client.release();
    }
  }
  private async release(
    lease: AcquisitionLease,
    availableAt: Timestamp,
    result: object,
    reason?: string,
  ) {
    const client = await this.database.connect();
    try {
      const released = await client.query(
        `UPDATE jobs SET state='available',lease_owner=NULL,lease_expires_at=NULL,available_at=$3,
                         payload_json=$4::jsonb,last_error_json=$5::jsonb,last_error_at=$6,
                         updated_at=$3,version=version+1
         WHERE id=$1 AND job_type='candidate_acquisition' AND state='leased' AND lease_owner=$2 AND updated_at=$7`,
        [
          scheduleId,
          lease.ownerId,
          availableAt,
          JSON.stringify(result),
          reason === undefined ? null : JSON.stringify({ message: reason }),
          reason === undefined ? null : availableAt,
          lease.startedAt,
        ],
      );
      if (released.rowCount !== 1)
        throw new Error("Acquisition schedule requires the active lease");
    } finally {
      client.release();
    }
  }
  public complete(input: {
    lease: AcquisitionLease;
    availableAt: Timestamp;
    summary: AcquisitionCycleSummary;
  }) {
    return this.release(input.lease, input.availableAt, {
      status: "completed",
      completedAt: input.availableAt,
      summary: input.summary,
    });
  }
  public retry(input: {
    lease: AcquisitionLease;
    availableAt: Timestamp;
    failedStage: AcquisitionStage;
    reason: string;
  }) {
    return this.release(
      input.lease,
      input.availableAt,
      { status: "retry_scheduled", failedStage: input.failedStage },
      input.reason,
    );
  }
}
