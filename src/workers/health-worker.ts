import type { Pool } from "pg";
import type { WalletAddress } from "../domain/shared/types.js";

export interface PaperPerformanceReport {
  readonly wallet: WalletAddress;
  readonly initialCashRaw: string;
  readonly cashRaw: string;
  readonly openCostRaw: string;
  readonly realizedPnlRaw: string;
  readonly fills: number;
  readonly openPositions: number;
  readonly pendingEntries: number;
  readonly pendingPositions: number;
  readonly workerErrors: number;
  readonly healthy: boolean;
}

interface ReportRow {
  readonly initial_cash_raw: string;
  readonly cash_raw: string;
  readonly open_cost_raw: string;
  readonly realized_pnl_raw: string;
  readonly fills: string;
  readonly open_positions: string;
  readonly pending_entries: string;
  readonly pending_positions: string;
  readonly worker_errors: string;
}

/** Produces one internally consistent operational snapshot from durable paper facts. */
export async function readPaperPerformanceReport(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<PaperPerformanceReport> {
  const result = await database.query<ReportRow>(
    `SELECT a.initial_cash_raw::text,
       (a.initial_cash_raw + COALESCE((SELECT sum(CASE event_type WHEN 'sell' THEN amount_raw ELSE -amount_raw END) FROM paper_cash_events WHERE wallet=a.wallet),0))::text AS cash_raw,
       COALESCE((SELECT sum(remaining_cost_raw) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0),0)::text AS open_cost_raw,
       COALESCE((SELECT sum(realized_pnl_raw) FROM paper_realized_performance WHERE wallet=a.wallet),0)::text AS realized_pnl_raw,
       (SELECT count(*) FROM paper_fills WHERE wallet=a.wallet)::text AS fills,
       (SELECT count(DISTINCT token_mint) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0)::text AS open_positions,
       (SELECT count(*) FROM jobs j JOIN entry_plans ep ON ep.signal_id=j.id
          WHERE j.job_type='entry_planning' AND ep.state='planned'
            AND j.state IN ('available','leased'))::text AS pending_entries,
       (SELECT count(*) FROM paper_position_work WHERE wallet=a.wallet AND available_at<=clock_timestamp())::text AS pending_positions,
       ((SELECT count(*) FROM paper_position_work WHERE wallet=a.wallet AND last_error IS NOT NULL))::text AS worker_errors
     FROM paper_accounts a WHERE a.wallet=$1`,
    [wallet],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Paper account is unavailable");
  const report = {
    wallet,
    initialCashRaw: row.initial_cash_raw,
    cashRaw: row.cash_raw,
    openCostRaw: row.open_cost_raw,
    realizedPnlRaw: row.realized_pnl_raw,
    fills: Number(row.fills),
    openPositions: Number(row.open_positions),
    pendingEntries: Number(row.pending_entries),
    pendingPositions: Number(row.pending_positions),
    workerErrors: Number(row.worker_errors),
    healthy: Number(row.worker_errors) === 0,
  } as const;
  if (
    [
      report.fills,
      report.openPositions,
      report.pendingEntries,
      report.pendingPositions,
      report.workerErrors,
    ].some((value) => !Number.isSafeInteger(value) || value < 0)
  )
    throw new Error("Paper performance report contains invalid counts");
  return Object.freeze(report);
}
