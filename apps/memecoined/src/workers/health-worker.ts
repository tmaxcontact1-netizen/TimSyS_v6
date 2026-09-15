import type { Pool } from "pg";
import type { WalletAddress } from "../domain/shared/types.js";

export interface PaperPerformanceReport {
  readonly wallet: WalletAddress;
  readonly initialCashRaw: string;
  readonly cashRaw: string;
  readonly openCostRaw: string;
  readonly openValueRaw: string;
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
  readonly open_value_raw: string;
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
    `WITH legacy AS (
       SELECT a.initial_cash_raw,
       (a.initial_cash_raw
        + COALESCE((SELECT sum(CASE event_type WHEN 'sell' THEN amount_raw ELSE -amount_raw END) FROM paper_cash_events WHERE wallet=a.wallet),0)
        - COALESCE((SELECT sum(execution_fee_raw) FROM paper_fills WHERE wallet=a.wallet),0)) AS cash_raw,
       COALESCE((SELECT sum(remaining_cost_raw) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0),0) AS open_cost_raw,
       COALESCE((SELECT sum(remaining_cost_raw) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0),0) AS open_value_raw,
       COALESCE((SELECT sum(realized_pnl_raw) FROM paper_realized_performance WHERE wallet=a.wallet),0) AS realized_pnl_raw,
       (SELECT count(*) FROM paper_fills WHERE wallet=a.wallet) AS fills,
       (SELECT count(DISTINCT token_mint) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0) AS open_positions,
       (SELECT count(*) FROM jobs j JOIN entry_plans ep ON ep.signal_id=j.id
          WHERE j.job_type='entry_planning' AND ep.state='planned'
            AND j.state IN ('available','leased')) AS pending_entries,
       (SELECT count(*) FROM paper_position_work WHERE wallet=a.wallet AND available_at<=clock_timestamp()) AS pending_positions,
       (SELECT count(*) FROM paper_position_work WHERE wallet=a.wallet AND last_error IS NOT NULL) AS worker_errors
       FROM paper_accounts a WHERE a.wallet=$1
     ), profiles AS (
       SELECT COALESCE(sum(initial_cash_raw),0) AS initial_cash_raw,
              COALESCE(sum(cash_raw),0) AS cash_raw,
              COALESCE((SELECT sum(cost_raw) FROM paper_profile_positions WHERE wallet=$1),0) AS open_cost_raw,
              COALESCE((SELECT sum(current_value_raw) FROM paper_profile_positions WHERE wallet=$1),0) AS open_value_raw,
              COALESCE(sum(realized_pnl_raw),0) AS realized_pnl_raw,
              (SELECT count(*) FROM paper_profile_fills WHERE wallet=$1) AS fills,
              (SELECT count(*) FROM paper_profile_positions WHERE wallet=$1) AS open_positions,
              (SELECT count(*) FROM paper_profile_candidate_decisions WHERE wallet=$1 AND entry_state IN ('pending','retrying')) AS pending_entries,
              (SELECT count(*) FROM paper_profile_positions WHERE wallet=$1) AS pending_positions,
              0::bigint AS worker_errors,
              count(*) AS profile_accounts
       FROM paper_profile_accounts WHERE wallet=$1
     )
     SELECT (CASE WHEN p.profile_accounts>0 THEN p.initial_cash_raw ELSE l.initial_cash_raw END)::text AS initial_cash_raw,
            (CASE WHEN p.profile_accounts>0 THEN p.cash_raw ELSE l.cash_raw END)::text AS cash_raw,
            (CASE WHEN p.profile_accounts>0 THEN p.open_cost_raw ELSE l.open_cost_raw END)::text AS open_cost_raw,
            (CASE WHEN p.profile_accounts>0 THEN p.open_value_raw ELSE l.open_value_raw END)::text AS open_value_raw,
            (CASE WHEN p.profile_accounts>0 THEN p.realized_pnl_raw ELSE l.realized_pnl_raw END)::text AS realized_pnl_raw,
            (CASE WHEN p.profile_accounts>0 THEN p.fills ELSE l.fills END)::text AS fills,
            (CASE WHEN p.profile_accounts>0 THEN p.open_positions ELSE l.open_positions END)::text AS open_positions,
            (CASE WHEN p.profile_accounts>0 THEN p.pending_entries ELSE l.pending_entries END)::text AS pending_entries,
            (CASE WHEN p.profile_accounts>0 THEN p.pending_positions ELSE l.pending_positions END)::text AS pending_positions,
            (l.worker_errors+p.worker_errors)::text AS worker_errors
       FROM legacy l CROSS JOIN profiles p`,
    [wallet],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Paper account is unavailable");
  const report = {
    wallet,
    initialCashRaw: row.initial_cash_raw,
    cashRaw: row.cash_raw,
    openCostRaw: row.open_cost_raw,
    openValueRaw: row.open_value_raw,
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
