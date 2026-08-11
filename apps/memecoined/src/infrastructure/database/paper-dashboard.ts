import type { Pool } from "pg";

import type { MintAddress, WalletAddress } from "../../domain/shared/types.js";

export interface PaperDashboardDetails {
  readonly positions: readonly Record<string, unknown>[];
  readonly pendingEntries: readonly Record<string, unknown>[];
  readonly fills: readonly Record<string, unknown>[];
  readonly performance: readonly Record<string, unknown>[];
  readonly events: readonly Record<string, unknown>[];
}

interface DashboardRow {
  readonly positions: unknown;
  readonly pending_entries: unknown;
  readonly fills: unknown;
  readonly performance: unknown;
  readonly events: unknown;
}

export interface PaperWorkerAlert {
  readonly tokenMint: string;
  readonly message: string;
  readonly retryAt: string;
  readonly lastMonitoredAt: string | null;
}

interface WorkerAlertRow {
  readonly token_mint: string;
  readonly last_error: string;
  readonly available_at: Date | string;
  readonly last_monitored_at: Date | string | null;
}

export interface PaperTokenDetails {
  readonly summary: Readonly<Record<string, unknown>>;
  readonly lots: readonly Record<string, unknown>[];
  readonly fills: readonly Record<string, unknown>[];
  readonly performance: readonly Record<string, unknown>[];
  readonly events: readonly Record<string, unknown>[];
}

interface TokenDashboardRow {
  readonly summary: unknown;
  readonly lots: unknown;
  readonly fills: unknown;
  readonly performance: unknown;
  readonly events: unknown;
}

export const paperPerformanceRanges = ["24h", "7d", "30d", "all"] as const;
export type PaperPerformanceRange = (typeof paperPerformanceRanges)[number];

export interface PaperPerformancePoint {
  readonly occurredAt: string;
  readonly realizedPnlRaw: string;
  readonly bookEquityRaw: string;
}

interface PerformanceHistoryRow {
  readonly occurred_at: Date | string;
  readonly realized_pnl_raw: string;
  readonly book_equity_raw: string;
}

const rangeIntervals: Readonly<Record<Exclude<PaperPerformanceRange, "all">, string>> =
  Object.freeze({ "24h": "24 hours", "7d": "7 days", "30d": "30 days" });

function timestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Reads bounded unresolved paper-position worker incidents for operator inspection. */
export async function readPaperWorkerAlerts(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<readonly PaperWorkerAlert[]> {
  const result = await database.query<WorkerAlertRow>(
    `SELECT token_mint,last_error,available_at,last_monitored_at
     FROM paper_position_work
     WHERE wallet=$1 AND last_error IS NOT NULL
     ORDER BY available_at DESC,token_mint LIMIT 50`,
    [wallet],
  );
  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        tokenMint: row.token_mint,
        message: row.last_error,
        retryAt: timestamp(row.available_at),
        lastMonitoredAt: row.last_monitored_at === null ? null : timestamp(row.last_monitored_at),
      }),
    ),
  );
}

/** Reads bounded cumulative realized performance without claiming market valuation history. */
export async function readPaperPerformanceHistory(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  range: PaperPerformanceRange,
): Promise<readonly PaperPerformancePoint[]> {
  const interval = range === "all" ? null : rangeIntervals[range];
  const result = await database.query<PerformanceHistoryRow>(
    `WITH account AS (
       SELECT initial_cash_raw,opened_at FROM paper_accounts WHERE wallet=$1
     ), boundary AS (
       SELECT CASE WHEN $2::text IS NULL THEN opened_at
                   ELSE GREATEST(opened_at,now()-$2::interval) END AS starts_at
       FROM account
     ), eligible AS (
       SELECT p.realized_at AS occurred_at,p.realized_pnl_raw AS pnl,
              row_number() OVER (ORDER BY p.realized_at DESC,p.fill_id DESC) AS recency
       FROM paper_realized_performance p,boundary b
       WHERE p.wallet=$1 AND p.realized_at>=b.starts_at
     ), events AS (
       SELECT occurred_at,pnl FROM eligible WHERE recency<=499
     ), baseline AS (
       SELECT COALESCE(min(e.occurred_at),b.starts_at) AS occurred_at,
              COALESCE((SELECT sum(p.realized_pnl_raw) FROM paper_realized_performance p
                        WHERE p.wallet=$1 AND p.realized_at<b.starts_at),0)
                + COALESCE(sum(e.pnl) FILTER (WHERE e.recency>499),0) AS pnl
       FROM boundary b LEFT JOIN eligible e ON true GROUP BY b.starts_at
     ), points AS (
       SELECT occurred_at,pnl,0 AS ordering FROM baseline
       UNION ALL SELECT occurred_at,pnl,1 FROM events
     )
     SELECT occurred_at,
            sum(pnl) OVER (ORDER BY occurred_at,ordering ROWS UNBOUNDED PRECEDING)::text AS realized_pnl_raw,
            (a.initial_cash_raw + sum(pnl) OVER
              (ORDER BY occurred_at,ordering ROWS UNBOUNDED PRECEDING))::text AS book_equity_raw
     FROM points CROSS JOIN account a ORDER BY occurred_at,ordering`,
    [wallet, interval],
  );
  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        occurredAt:
          row.occurred_at instanceof Date
            ? row.occurred_at.toISOString()
            : new Date(row.occurred_at).toISOString(),
        realizedPnlRaw: row.realized_pnl_raw,
        bookEquityRaw: row.book_equity_raw,
      }),
    ),
  );
}

function rows(value: unknown, label: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null))
    throw new Error(`Invalid paper dashboard ${label}`);
  return Object.freeze(value.map((item) => Object.freeze(item as Record<string, unknown>)));
}

/** Reads one token's bounded lifecycle from one PostgreSQL statement and snapshot. */
export async function readPaperTokenDetails(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
  mint: MintAddress,
): Promise<PaperTokenDetails> {
  const result = await database.query<TokenDashboardRow>(
    `SELECT
       jsonb_build_object(
         'token_mint',$2,
         'open_amount_raw',COALESCE((SELECT sum(current_amount_raw)::text FROM paper_position_lots WHERE wallet=$1 AND token_mint=$2 AND current_amount_raw>0),'0'),
         'open_cost_raw',COALESCE((SELECT sum(remaining_cost_raw)::text FROM paper_position_lots WHERE wallet=$1 AND token_mint=$2 AND current_amount_raw>0),'0'),
         'open_lots',COALESCE((SELECT count(*)::int FROM paper_position_lots WHERE wallet=$1 AND token_mint=$2 AND current_amount_raw>0),0),
         'realized_pnl_raw',COALESCE((SELECT sum(realized_pnl_raw)::text FROM paper_realized_performance WHERE wallet=$1 AND token_mint=$2),'0')) AS summary,
       COALESCE((SELECT jsonb_agg(l ORDER BY l.opened_at DESC,l.id)
         FROM (SELECT id,acquired_amount_raw::text,current_amount_raw::text,
                      cost_raw::text,remaining_cost_raw::text,opened_at
               FROM paper_position_lots WHERE wallet=$1 AND token_mint=$2
               ORDER BY opened_at DESC,id LIMIT 50) l),'[]') AS lots,
       COALESCE((SELECT jsonb_agg(f ORDER BY f.filled_at DESC,f.id)
         FROM (SELECT id,side,token_amount_raw::text,settlement_amount_raw::text,quoted_at,filled_at
               FROM paper_fills WHERE wallet=$1 AND token_mint=$2
               ORDER BY filled_at DESC,id LIMIT 100) f),'[]') AS fills,
       COALESCE((SELECT jsonb_agg(r ORDER BY r.realized_at DESC,r.fill_id)
         FROM (SELECT fill_id,proceeds_raw::text,released_cost_raw::text,
                      realized_pnl_raw::text,realized_at
               FROM paper_realized_performance WHERE wallet=$1 AND token_mint=$2
               ORDER BY realized_at DESC,fill_id LIMIT 100) r),'[]') AS performance,
       COALESCE((SELECT jsonb_agg(e ORDER BY e.evaluated_at DESC,e.id)
         FROM (SELECT id,evaluated_at,action,rule_id,open_amount_raw::text,
                      requested_amount_raw::text,executable_value_sol::text
               FROM paper_exit_evaluations WHERE wallet=$1 AND token_mint=$2
               ORDER BY evaluated_at DESC,id LIMIT 100) e),'[]') AS events`,
    [wallet, mint],
  );
  const row = result.rows[0];
  if (row === undefined || typeof row.summary !== "object" || row.summary === null)
    throw new Error("Paper token details are unavailable");
  return Object.freeze({
    summary: Object.freeze(row.summary as Record<string, unknown>),
    lots: rows(row.lots, "token lots"),
    fills: rows(row.fills, "token fills"),
    performance: rows(row.performance, "token performance"),
    events: rows(row.events, "token events"),
  });
}

/** Reads all detail panels from one PostgreSQL statement and one database snapshot. */
export async function readPaperDashboardDetails(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<PaperDashboardDetails> {
  const result = await database.query<DashboardRow>(
    `SELECT
       COALESCE((SELECT jsonb_agg(p ORDER BY p.opened_at DESC, p.token_mint)
         FROM (SELECT token_mint, sum(current_amount_raw)::text AS amount_raw,
                      sum(remaining_cost_raw)::text AS cost_raw, min(opened_at) AS opened_at,
                      count(*)::int AS lots,
                      EXISTS (SELECT 1 FROM paper_position_close_requests r
                        WHERE r.wallet=$1 AND r.token_mint=paper_position_lots.token_mint
                          AND r.state='pending') AS close_pending
               FROM paper_position_lots WHERE wallet=$1 AND current_amount_raw>0
               GROUP BY token_mint ORDER BY min(opened_at) DESC, token_mint LIMIT 50) p),'[]') AS positions,
       COALESCE((SELECT jsonb_agg(e ORDER BY e.created_at,e.signal_id)
         FROM (SELECT o.signal_id::text,c.mint_address AS token_mint,
                      o.intended_input_amount::text AS input_amount_raw,
                      j.version,j.created_at
               FROM orders o
               JOIN entry_plans ep ON ep.signal_id=o.signal_id AND ep.state='planned'
               JOIN signals s ON s.id=o.signal_id
               JOIN candidates c ON c.id=s.candidate_id
               JOIN jobs j ON j.id=ep.signal_id AND j.job_type='entry_planning'
                 AND j.state='available' AND j.lease_owner IS NULL
               WHERE o.wallet_address=$1 AND o.state='approved'
               ORDER BY j.created_at,o.signal_id LIMIT 50) e),'[]') AS pending_entries,
       COALESCE((SELECT jsonb_agg(f ORDER BY f.filled_at DESC, f.id)
         FROM (SELECT id,side,token_mint,token_amount_raw::text,settlement_amount_raw::text,
                      quoted_at,filled_at
               FROM paper_fills WHERE wallet=$1 ORDER BY filled_at DESC,id LIMIT 100) f),'[]') AS fills,
       COALESCE((SELECT jsonb_agg(r ORDER BY r.realized_at DESC, r.fill_id)
         FROM (SELECT fill_id,token_mint,proceeds_raw::text,released_cost_raw::text,
                      realized_pnl_raw::text,realized_at
               FROM paper_realized_performance WHERE wallet=$1
               ORDER BY realized_at DESC,fill_id LIMIT 100) r),'[]') AS performance,
       COALESCE((SELECT jsonb_agg(e ORDER BY e.evaluated_at DESC, e.id)
         FROM (SELECT id,token_mint,evaluated_at,action,rule_id,open_amount_raw::text,
                      requested_amount_raw::text,executable_value_sol::text
               FROM paper_exit_evaluations WHERE wallet=$1
               ORDER BY evaluated_at DESC,id LIMIT 100) e),'[]') AS events`,
    [wallet],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Paper dashboard details are unavailable");
  return Object.freeze({
    positions: rows(row.positions, "positions"),
    pendingEntries: rows(row.pending_entries, "pending entries"),
    fills: rows(row.fills, "fills"),
    performance: rows(row.performance, "performance"),
    events: rows(row.events, "events"),
  });
}
