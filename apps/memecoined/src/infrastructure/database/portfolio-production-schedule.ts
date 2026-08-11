import type { PoolClient } from "pg";

import type {
  PortfolioProductionLease,
  PortfolioProductionSchedule,
} from "../../application/services/portfolio-production-schedule.js";
import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

const scheduleId = "00000000-0000-5000-a000-000000000028";

export class PostgresPortfolioProductionSchedule implements PortfolioProductionSchedule {
  public constructor(private readonly database: DatabasePort) {}

  public async claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
  }): Promise<PortfolioProductionLease | null> {
    if (input.ownerId.trim().length === 0) throw new TypeError("Portfolio lease owner is required");
    if (input.leaseExpiresAt <= input.now)
      throw new RangeError("Portfolio lease must expire in the future");
    const result = await this.database.connect();
    try {
      const claimed = await result.query<{ observed_at: string }>(
        `UPDATE jobs SET state='leased', lease_owner=$2, lease_expires_at=$3,
                         attempts=attempts+1, updated_at=$1, version=version+1
         WHERE id=$4 AND job_type='portfolio_production'
           AND ((state='available' AND available_at <= $1)
             OR (state='leased' AND lease_expires_at <= $1))
         RETURNING updated_at AS observed_at`,
        [input.now, input.ownerId, input.leaseExpiresAt, scheduleId],
      );
      const row = claimed.rows[0];
      return row === undefined
        ? null
        : Object.freeze({ ownerId: input.ownerId, observedAt: asTimestamp(row.observed_at) });
    } finally {
      result.release();
    }
  }

  private async release(
    lease: PortfolioProductionLease,
    availableAt: Timestamp,
    reason?: string,
  ): Promise<void> {
    const client = await this.database.connect();
    try {
      const released = await client.query(
        `UPDATE jobs SET state='available', lease_owner=NULL, lease_expires_at=NULL,
                         available_at=$3, last_error_json=$4::jsonb, last_error_at=$5,
                         updated_at=$3, version=version+1
         WHERE id=$1 AND job_type='portfolio_production' AND state='leased' AND lease_owner=$2
           AND updated_at=$6`,
        [
          scheduleId,
          lease.ownerId,
          availableAt,
          reason === undefined ? null : JSON.stringify({ message: reason }),
          reason === undefined ? null : availableAt,
          lease.observedAt,
        ],
      );
      if (released.rowCount !== 1) throw new Error("Portfolio schedule requires the active lease");
    } finally {
      client.release();
    }
  }

  public complete(input: {
    readonly lease: PortfolioProductionLease;
    readonly availableAt: Timestamp;
  }) {
    return this.release(input.lease, input.availableAt);
  }

  public retry(input: {
    readonly lease: PortfolioProductionLease;
    readonly availableAt: Timestamp;
    readonly reason: string;
  }) {
    return this.release(input.lease, input.availableAt, input.reason);
  }
}
