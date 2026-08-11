import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { MintAddress, Timestamp, WalletAddress } from "../../domain/shared/types.js";
import {
  allocatePaperSale,
  paperFillHash,
  paperLotId,
  type PaperFill,
  type PaperLot,
} from "../../application/services/paper-accounting.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export class PostgresPaperAccountingLedger {
  public constructor(private readonly database: DatabasePort) {}

  public async openAccount(input: {
    wallet: WalletAddress;
    settlementMint: MintAddress;
    initialCashRaw: bigint;
    openedAt: Timestamp;
  }): Promise<void> {
    if (input.initialCashRaw < 0n)
      throw new InvariantViolationError("Initial paper cash cannot be negative");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const account = await client.query(
        `INSERT INTO paper_accounts (wallet,settlement_mint,opened_at,initial_cash_raw)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [input.wallet, input.settlementMint, input.openedAt, input.initialCashRaw.toString()],
      );
      if (account.rowCount === 0) {
        const replay = await client.query<{ matches: boolean }>(
          `SELECT settlement_mint=$2 AND initial_cash_raw=$3 AS matches
           FROM paper_accounts WHERE wallet=$1`,
          [input.wallet, input.settlementMint, input.initialCashRaw.toString()],
        );
        if (replay.rows[0]?.matches !== true)
          throw new InvariantViolationError(
            "Paper account replay conflicts with durable authority",
          );
      }
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  public async recordFill(fill: PaperFill): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const account = await client.query<{ initial_cash_raw: string }>(
        `SELECT initial_cash_raw::text FROM paper_accounts WHERE wallet=$1 FOR UPDATE`,
        [fill.wallet],
      );
      if (account.rows[0] === undefined)
        throw new InvariantViolationError("Paper account is unavailable");
      const events = await client.query<{ net_raw: string }>(
        `SELECT COALESCE(sum(CASE event_type WHEN 'sell' THEN amount_raw ELSE -amount_raw END),0)::text AS net_raw
         FROM paper_cash_events WHERE wallet=$1`,
        [fill.wallet],
      );
      const cashRaw =
        BigInt(account.rows[0].initial_cash_raw) + BigInt(events.rows[0]?.net_raw ?? "0");
      if (fill.side === "buy" && cashRaw < fill.settlementAmountRaw)
        throw new InvariantViolationError("Paper fill exceeds available cash");
      const inserted = await client.query(
        `INSERT INTO paper_fills
          (id,wallet,side,token_mint,token_amount_raw,settlement_amount_raw,quoted_at,filled_at,quote_fingerprint,content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
        [
          fill.id,
          fill.wallet,
          fill.side,
          fill.tokenMint,
          fill.tokenAmountRaw.toString(),
          fill.settlementAmountRaw.toString(),
          fill.quotedAt,
          fill.filledAt,
          fill.quoteFingerprint,
          paperFillHash(fill),
        ],
      );
      if (inserted.rowCount !== 1) {
        const replay = await client.query<{ matches: boolean }>(
          `SELECT content_hash=$3 AS matches FROM paper_fills
           WHERE id=$1 AND wallet=$2`,
          [fill.id, fill.wallet, paperFillHash(fill)],
        );
        if (replay.rows[0]?.matches !== true)
          throw new InvariantViolationError("Paper fill replay conflicts with durable authority");
        await client.query("COMMIT");
        return;
      }
      if (fill.side === "buy") {
        await client.query(
          `INSERT INTO paper_position_lots
           (id,wallet,token_mint,source_fill_id,acquired_amount_raw,current_amount_raw,cost_raw,remaining_cost_raw,opened_at)
           VALUES ($1,$2,$3,$4,$5,$5,$6,$6,$7)`,
          [
            paperLotId(fill),
            fill.wallet,
            fill.tokenMint,
            fill.id,
            fill.tokenAmountRaw.toString(),
            fill.settlementAmountRaw.toString(),
            fill.filledAt,
          ],
        );
      } else {
        const rows = await client.query<{
          id: string;
          current_amount_raw: string;
          remaining_cost_raw: string;
        }>(
          `SELECT id,current_amount_raw::text,remaining_cost_raw::text FROM paper_position_lots
           WHERE wallet=$1 AND token_mint=$2 AND current_amount_raw>0 ORDER BY opened_at,id FOR UPDATE`,
          [fill.wallet, fill.tokenMint],
        );
        const lots: PaperLot[] = rows.rows.map((row) => ({
          id: row.id,
          currentAmountRaw: BigInt(row.current_amount_raw),
          remainingCostRaw: BigInt(row.remaining_cost_raw),
        }));
        const disposals = allocatePaperSale(fill, lots);
        for (const disposal of disposals) {
          await client.query(
            `INSERT INTO paper_lot_disposals (fill_id,lot_id,token_amount_raw,released_cost_raw) VALUES ($1,$2,$3,$4)`,
            [
              fill.id,
              disposal.lotId,
              disposal.tokenAmountRaw.toString(),
              disposal.releasedCostRaw.toString(),
            ],
          );
          await client.query(
            `UPDATE paper_position_lots SET current_amount_raw=current_amount_raw-$2,
             remaining_cost_raw=remaining_cost_raw-$3,
             closed_at=CASE WHEN current_amount_raw=$2 THEN $4 ELSE NULL END WHERE id=$1`,
            [
              disposal.lotId,
              disposal.tokenAmountRaw.toString(),
              disposal.releasedCostRaw.toString(),
              fill.filledAt,
            ],
          );
        }
        const releasedCostRaw = disposals.reduce(
          (total, disposal) => total + disposal.releasedCostRaw,
          0n,
        );
        await client.query(
          `INSERT INTO paper_realized_performance
           (fill_id,wallet,token_mint,proceeds_raw,released_cost_raw,realized_pnl_raw,realized_at)
           VALUES ($1,$2,$3,$4,$5,$4-$5,$6)`,
          [
            fill.id,
            fill.wallet,
            fill.tokenMint,
            fill.settlementAmountRaw.toString(),
            releasedCostRaw.toString(),
            fill.filledAt,
          ],
        );
        const remaining = await client.query<{ open_amount_raw: string }>(
          `SELECT COALESCE(sum(current_amount_raw),0)::text AS open_amount_raw
           FROM paper_position_lots WHERE wallet=$1 AND token_mint=$2`,
          [fill.wallet, fill.tokenMint],
        );
        if (BigInt(remaining.rows[0]?.open_amount_raw ?? "0") === 0n) {
          await client.query(
            `WITH fulfilled AS (
               UPDATE paper_position_close_requests SET state='fulfilled',fulfilled_at=$3
               WHERE wallet=$1 AND token_mint=$2 AND state='pending' RETURNING id
             ) INSERT INTO paper_operator_control_audit
               (id,wallet,action,target,payload_json,occurred_at)
             SELECT $4,$1,'position_close_fulfilled',$2,
               jsonb_build_object('requestId',id,'fillId',$5),$3 FROM fulfilled`,
            [fill.wallet, fill.tokenMint, fill.filledAt, randomUUID(), fill.id],
          );
        }
      }
      await client.query(
        `INSERT INTO paper_cash_events (id,wallet,event_type,amount_raw,occurred_at,content_hash)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          fill.id,
          fill.wallet,
          fill.side,
          fill.settlementAmountRaw.toString(),
          fill.filledAt,
          paperFillHash(fill),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}
