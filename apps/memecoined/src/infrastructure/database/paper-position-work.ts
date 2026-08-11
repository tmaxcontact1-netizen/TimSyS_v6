import type { Pool } from "pg";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { MintAddress, Timestamp, WalletAddress } from "../../domain/shared/types.js";
import type {
  PaperPositionLease,
  PaperPositionWorkQueue,
} from "../../application/services/paper-position-monitor.js";

export class PostgresPaperPositionWorkQueue implements PaperPositionWorkQueue {
  public constructor(
    private readonly database: Pick<Pool, "query">,
    private readonly wallet: WalletAddress,
  ) {}

  public async claim(input: {
    ownerId: string;
    now: Timestamp;
    leaseExpiresAt: Timestamp;
    limit: number;
  }): Promise<readonly PaperPositionLease[]> {
    await this.database.query(
      `INSERT INTO paper_position_work (wallet,token_mint,available_at)
       SELECT wallet,token_mint,$2 FROM paper_position_lots
       WHERE wallet=$1 AND current_amount_raw>0 GROUP BY wallet,token_mint
       ON CONFLICT DO NOTHING`,
      [this.wallet, input.now],
    );
    const result = await this.database.query<{
      token_mint: string;
      open_amount_raw: string;
      lease_acquired_at: string;
    }>(
      `WITH due AS (
         SELECT w.wallet,w.token_mint FROM paper_position_work w
         WHERE w.wallet=$1 AND w.available_at<=$3
           AND (w.lease_owner IS NULL OR w.lease_expires_at<=$3)
           AND EXISTS (SELECT 1 FROM paper_position_lots l WHERE l.wallet=w.wallet AND l.token_mint=w.token_mint AND l.current_amount_raw>0)
         ORDER BY w.available_at,w.token_mint FOR UPDATE SKIP LOCKED LIMIT $5
       ), claimed AS (
         UPDATE paper_position_work w SET lease_owner=$2,lease_acquired_at=$3,lease_expires_at=$4,last_error=NULL
         FROM due WHERE w.wallet=due.wallet AND w.token_mint=due.token_mint
         RETURNING w.token_mint,w.lease_acquired_at
       )
       SELECT c.token_mint,sum(l.current_amount_raw)::text AS open_amount_raw,c.lease_acquired_at::text
       FROM claimed c JOIN paper_position_lots l ON l.wallet=$1 AND l.token_mint=c.token_mint AND l.current_amount_raw>0
       GROUP BY c.token_mint,c.lease_acquired_at ORDER BY c.token_mint`,
      [this.wallet, input.ownerId, input.now, input.leaseExpiresAt, input.limit],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          tokenMint: row.token_mint as MintAddress,
          openAmountRaw: BigInt(row.open_amount_raw),
          leaseOwner: input.ownerId,
          leaseAcquiredAt: row.lease_acquired_at as Timestamp,
        }),
      ),
    );
  }

  public async complete(input: {
    lease: PaperPositionLease;
    fill: { id: string } | null;
    monitoredAt: Timestamp;
    nextAt: Timestamp;
  }): Promise<void> {
    const result = await this.database.query(
      `UPDATE paper_position_work SET available_at=$5,lease_owner=NULL,lease_acquired_at=NULL,lease_expires_at=NULL,last_monitored_at=$4,last_error=NULL
       WHERE wallet=$1 AND token_mint=$2 AND lease_owner=$3 AND lease_acquired_at=$6`,
      [
        this.wallet,
        input.lease.tokenMint,
        input.lease.leaseOwner,
        input.monitoredAt,
        input.nextAt,
        input.lease.leaseAcquiredAt,
      ],
    );
    if (result.rowCount !== 1)
      throw new InvariantViolationError("Paper position completion lost its active lease");
  }

  public async retry(input: {
    lease: PaperPositionLease;
    availableAt: Timestamp;
    reason: string;
  }): Promise<void> {
    const result = await this.database.query(
      `UPDATE paper_position_work SET available_at=$5,lease_owner=NULL,lease_acquired_at=NULL,lease_expires_at=NULL,last_error=$4
       WHERE wallet=$1 AND token_mint=$2 AND lease_owner=$3 AND lease_acquired_at=$6`,
      [
        this.wallet,
        input.lease.tokenMint,
        input.lease.leaseOwner,
        input.reason.slice(0, 1000),
        input.availableAt,
        input.lease.leaseAcquiredAt,
      ],
    );
    if (result.rowCount !== 1)
      throw new InvariantViolationError("Paper position retry lost its active lease");
  }
}
