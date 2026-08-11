import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { MintAddress, WalletAddress } from "../../domain/shared/types.js";

export class PaperControlConflictError extends Error {}

export interface CancelledPaperEntry {
  readonly signalId: string;
  readonly state: "cancelled";
  readonly version: number;
}

export interface PaperPositionCloseRequest {
  readonly id: string;
  readonly tokenMint: MintAddress;
  readonly expectedOpenAmountRaw: string;
  readonly state: "pending";
  readonly requestedAt: string;
}

export async function cancelPendingPaperEntry(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  signalId: string,
  expectedVersion: number,
  occurredAt: Date,
): Promise<CancelledPaperEntry> {
  const result = await database.query<{ signal_id: string; version: string | number }>(
    `WITH cancelled_order AS (
       UPDATE orders o SET state='cancelled',updated_at=$4,version=version+1
       FROM jobs j,entry_plans ep
       WHERE o.signal_id=$2 AND o.wallet_address=$1 AND o.state='approved'
         AND ep.signal_id=o.signal_id AND ep.state='planned'
         AND j.id=ep.signal_id AND j.job_type='entry_planning'
         AND j.state='available' AND j.version=$3
       RETURNING o.signal_id
     ), cancelled AS (
       UPDATE entry_plans ep SET state='cancelled' FROM cancelled_order o
       WHERE ep.signal_id=o.signal_id AND ep.state='planned' RETURNING ep.signal_id
     ), completed AS (
       UPDATE jobs j SET state='completed',updated_at=$4,version=version+1
       FROM cancelled c WHERE j.id=c.signal_id AND j.state='available'
       RETURNING j.id,j.version
     ), audited AS (
       INSERT INTO paper_operator_control_audit (id,wallet,action,target,payload_json,occurred_at)
       SELECT $5,$1,'entry_cancelled',id::text,
         jsonb_build_object('signalId',id::text,'expectedVersion',$3,'resultingVersion',version),$4
       FROM completed
     ) SELECT id::text AS signal_id,version FROM completed`,
    [wallet, signalId, expectedVersion, occurredAt, randomUUID()],
  );
  const row = result.rows[0];
  if (row === undefined) throw new PaperControlConflictError("Paper entry cancellation conflict");
  return Object.freeze({
    signalId: row.signal_id,
    state: "cancelled",
    version: Number(row.version),
  });
}

export async function requestPaperPositionClose(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  tokenMint: MintAddress,
  expectedOpenAmountRaw: bigint,
  occurredAt: Date,
): Promise<PaperPositionCloseRequest> {
  const id = randomUUID();
  const result = await database.query<{
    id: string;
    token_mint: MintAddress;
    expected_open_amount_raw: string;
    requested_at: Date | string;
  }>(
    `WITH locked_inventory AS (
       SELECT wallet,token_mint,current_amount_raw FROM paper_position_lots
       WHERE wallet=$1 AND token_mint=$2 AND current_amount_raw>0 FOR UPDATE
     ), inventory AS (
       SELECT wallet,token_mint,sum(current_amount_raw)::numeric AS open_amount_raw
       FROM locked_inventory
       GROUP BY wallet,token_mint HAVING sum(current_amount_raw)=$3::numeric
     ), requested AS (
       INSERT INTO paper_position_close_requests
         (id,wallet,token_mint,expected_open_amount_raw,requested_at)
       SELECT $4,wallet,token_mint,open_amount_raw,$5 FROM inventory
       ON CONFLICT (wallet,token_mint) WHERE state='pending' DO NOTHING RETURNING *
     ), audited AS (
       INSERT INTO paper_operator_control_audit (id,wallet,action,target,payload_json,occurred_at)
       SELECT $6,$1,'position_close_requested',token_mint,
         jsonb_build_object('requestId',id,'expectedOpenAmountRaw',expected_open_amount_raw::text),$5
       FROM requested
     ) SELECT id,token_mint,expected_open_amount_raw::text,requested_at FROM requested`,
    [wallet, tokenMint, expectedOpenAmountRaw.toString(), id, occurredAt, randomUUID()],
  );
  const row = result.rows[0];
  if (row === undefined) throw new PaperControlConflictError("Paper position close conflict");
  return Object.freeze({
    id: row.id,
    tokenMint: row.token_mint,
    expectedOpenAmountRaw: row.expected_open_amount_raw,
    state: "pending",
    requestedAt: new Date(row.requested_at).toISOString(),
  });
}
