import type { Pool } from "pg";

import type { MintAddress, WalletAddress } from "../../domain/shared/types.js";

export interface PaperDashboardDetails {
  readonly positions: readonly Record<string, unknown>[];
  readonly pendingEntries: readonly Record<string, unknown>[];
  readonly fills: readonly Record<string, unknown>[];
  readonly performance: readonly Record<string, unknown>[];
  readonly events: readonly Record<string, unknown>[];
}

export interface FocusedPaperDashboard {
  readonly profiles: readonly Record<string, unknown>[];
  readonly evaluations: readonly Record<string, unknown>[];
  readonly trades: readonly Record<string, unknown>[];
  readonly rejectionReasons: readonly Record<string, unknown>[];
}

/** The focused operator view: two strategies, their actual decisions and their
 * actual trade outcomes. Values are returned as stored, without invented scores. */
export async function readFocusedPaperDashboard(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<FocusedPaperDashboard> {
  const profileIds = ["fast_furious", "oscillation_trader"];
  const [profiles, evaluations, trades, rejectionReasons] = await Promise.all([
    database.query(
      `SELECT a.profile_id,a.enabled,a.mode,a.allocation_bps,a.version,a.updated_at,
              COALESCE(ac.initial_cash_raw,0)::text AS initial_cash_raw,
              COALESCE(ac.cash_raw,0)::text AS cash_raw,
              COALESCE(ac.realized_pnl_raw,0)::text AS realized_pnl_raw,
              COALESCE(p.open_positions,0)::int AS open_positions,
              COALESCE(p.open_cost_raw,0)::text AS open_cost_raw,
              COALESCE(o.closed,0)::int AS closed_trades,
              COALESCE(o.wins,0)::int AS winning_trades,
              COALESCE(o.losses,0)::int AS losing_trades,
              COALESCE(o.net_bps,0)::text AS cumulative_net_bps,
              COALESCE(s.evaluated,0)::int AS evaluated,
              COALESCE(s.accepted,0)::int AS accepted,
              COALESCE(s.rejected,0)::int AS rejected,
              s.last_evaluated_at
         FROM paper_profile_activations a
         LEFT JOIN paper_profile_accounts ac USING(wallet,profile_id)
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS open_positions,COALESCE(sum(cost_raw),0) AS open_cost_raw
             FROM paper_profile_positions p
            WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id
         ) p ON true
         LEFT JOIN LATERAL (
           SELECT count(*) FILTER (WHERE lifecycle_state='closed')::int AS closed,
                  count(*) FILTER (WHERE lifecycle_state='closed' AND realized_net_bps>0)::int AS wins,
                  count(*) FILTER (WHERE lifecycle_state='closed' AND realized_net_bps<=0)::int AS losses,
                  COALESCE(sum(realized_net_bps) FILTER (WHERE lifecycle_state='closed'),0) AS net_bps
             FROM paper_profile_signal_outcomes o
            WHERE o.wallet=a.wallet AND o.profile_id=a.profile_id
         ) o ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::int AS evaluated,count(*) FILTER (WHERE eligible)::int AS accepted,
                  count(*) FILTER (WHERE NOT eligible)::int AS rejected,max(observed_at) AS last_evaluated_at
             FROM paper_profile_signals s
            WHERE s.wallet=a.wallet AND s.profile_id=a.profile_id
         ) s ON true
        WHERE a.wallet=$1 AND a.profile_id=ANY($2::text[]) ORDER BY a.profile_id`,
      [wallet, profileIds],
    ),
    database.query(
      `SELECT s.id::text,s.observed_at,s.profile_id,s.token_mint,s.signal_type,s.eligible,
              s.score,s.rejection_reasons_json,s.gates_json,s.metrics_json,
              COALESCE(o.lifecycle_state,CASE WHEN s.eligible THEN 'accepted' ELSE 'rejected' END) AS outcome
         FROM paper_profile_signals s
         LEFT JOIN paper_profile_signal_outcomes o ON o.signal_id=s.id
        WHERE s.wallet=$1 AND s.profile_id=ANY($2::text[])
        ORDER BY s.observed_at DESC,s.id DESC LIMIT 500`,
      [wallet, profileIds],
    ),
    database.query(
      `SELECT o.signal_id::text,o.profile_id,o.token_mint,o.lifecycle_state,o.entered_at,o.exited_at,
              o.exit_reason,o.planned_target_bps,o.planned_stop_bps,o.estimated_friction_bps,
              o.realized_gross_bps::text,o.realized_net_bps::text,o.realized_friction_bps::text,
              o.maximum_favorable_excursion_bps::text,o.maximum_adverse_excursion_bps::text,
              o.holding_seconds,entry.settlement_amount_raw::text AS entry_cost_raw,
              exit.settlement_amount_raw::text AS exit_value_raw
         FROM paper_profile_signal_outcomes o
         LEFT JOIN paper_profile_fills entry ON entry.id=o.entry_fill_id
         LEFT JOIN paper_profile_fills exit ON exit.id=o.exit_fill_id
        WHERE o.wallet=$1 AND o.profile_id=ANY($2::text[])
          AND o.lifecycle_state IN ('entered','closed')
        ORDER BY COALESCE(o.exited_at,o.entered_at) DESC,o.signal_id DESC LIMIT 500`,
      [wallet, profileIds],
    ),
    database.query(
      `SELECT s.profile_id,reason.value AS reason,count(*)::int AS occurrences,
              count(DISTINCT s.token_mint)::int AS tokens,max(s.observed_at) AS last_seen_at
         FROM paper_profile_signals s
         CROSS JOIN LATERAL jsonb_array_elements_text(s.rejection_reasons_json) reason(value)
        WHERE s.wallet=$1 AND s.profile_id=ANY($2::text[]) AND NOT s.eligible
        GROUP BY s.profile_id,reason.value ORDER BY occurrences DESC,reason.value LIMIT 100`,
      [wallet, profileIds],
    ),
  ]);
  return Object.freeze({
    profiles: rows(profiles.rows, "focused profiles"),
    evaluations: rows(evaluations.rows, "focused evaluations"),
    trades: rows(trades.rows, "focused trades"),
    rejectionReasons: rows(rejectionReasons.rows, "focused rejection reasons"),
  });
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

export interface AcquisitionPipelineStatus {
  readonly state: string;
  readonly nextRunAt: string;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: string | null;
  readonly attempts: number;
  readonly lastResult: Readonly<Record<string, unknown>>;
  readonly lastError: Readonly<Record<string, unknown>> | null;
  readonly work: readonly Readonly<{
    jobType: string;
    state: string;
    count: number;
    retrying: number;
    maximumAttempts: number;
    lastError: string | null;
    screenedOutLast24Hours: number;
    lastScreeningReason: string | null;
  }>[];
}

/** A bounded, per-strategy account of the last day's paper-trading decisions. */
export async function readStrategyFunnel(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<readonly Record<string, unknown>[]> {
  const result = await database.query(
    `SELECT a.profile_id,a.mode,
            COALESCE(s.signals,0)::int AS signals,
            COALESCE(s.distinct_tokens,0)::int AS distinct_tokens,
            COALESCE(s.patterns,0)::int AS patterns,
            COALESCE(s.market_confirmed,0)::int AS market_confirmed,
            COALESCE(s.qualified,0)::int AS qualified,
            COALESCE(d.quote_failures,0)::int AS quote_failures,
            COALESCE(f.buys,0)::int AS buys,
            (SELECT q.last_entry_error FROM paper_profile_candidate_decisions q
              WHERE q.wallet=a.wallet AND q.profile_id=a.profile_id
                AND q.last_entry_error IS NOT NULL
                AND q.evaluated_at>=now()-interval '24 hours'
              ORDER BY q.evaluated_at DESC LIMIT 1) AS latest_execution_blocker,
            (SELECT x.reason FROM (
               SELECT NULLIF(q.rejection_reasons_json->>0,'') AS reason,
                      count(*) AS uses
                 FROM paper_profile_signals q
                WHERE q.wallet=a.wallet AND q.profile_id=a.profile_id
                  AND q.observed_at>=now()-interval '24 hours' AND NOT q.eligible
                GROUP BY 1 ORDER BY uses DESC LIMIT 1
             ) x) AS main_rejection
       FROM paper_profile_activations a
       LEFT JOIN LATERAL (
         SELECT count(*) AS signals,
                count(DISTINCT token_mint) AS distinct_tokens,
                count(*) FILTER (WHERE signal_type IS NOT NULL) AS patterns,
                count(*) FILTER (WHERE metrics_json->>'marketConfirmed'='true'
                                      OR metrics_json->'oscillation'->>'regimeQualified'='true') AS market_confirmed,
                count(DISTINCT token_mint) FILTER (WHERE eligible) AS qualified
           FROM paper_profile_signals e
          WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id
            AND e.observed_at>=now()-interval '24 hours'
       ) s ON true
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE last_entry_error ILIKE '%quote%'
                  OR last_entry_error ILIKE '%round-trip cost%') AS quote_failures
           FROM paper_profile_candidate_decisions d
          WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id
            AND d.evaluated_at>=now()-interval '24 hours'
       ) d ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS buys FROM paper_profile_fills f
          WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id AND f.side='buy'
            AND f.filled_at>=now()-interval '24 hours'
       ) f ON true
      WHERE a.wallet=$1 AND a.enabled=true ORDER BY a.profile_id`,
    [wallet],
  );
  return result.rows;
}

/** Exploratory, gross-price outcomes for non-overlapping token/profile windows.
 * This is not executable P&L: it intentionally does not estimate fees, route
 * changes or whether a position could have been filled at the later quote.
 */
export async function readPaperOpportunityAudit(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
): Promise<readonly Record<string, unknown>[]> {
  const result = await database.query(
    `WITH ranked AS (
       SELECT e.profile_id,e.token_mint,e.observed_at,g.stage,
              (e.signal_json->>'executableOutputAmountRaw')::numeric AS entry_output,
              row_number() OVER (PARTITION BY e.profile_id,e.token_mint,
                floor(extract(epoch FROM e.observed_at)/600),g.stage
                ORDER BY e.observed_at) AS sample_rank
         FROM paper_fast_signal_events e CROSS JOIN LATERAL (VALUES
           ('observed',true),
           ('pattern',e.signal_json->>'pattern' NOT IN ('none','insufficient_history')),
           ('market',e.signal_json->>'marketConfirmed'='true'),
           ('adaptive',e.signal_json->>'adaptiveEntryEligible'='true'),
           ('all_gates',e.eligible)
         ) g(stage,passed)
        WHERE e.wallet=$1 AND e.observed_at>=now()-interval '24 hours'
          AND e.observed_at<=now()-interval '7 minutes'
          AND e.signal_json ? 'executableOutputAmountRaw'
          AND g.passed
     ), samples AS (
       SELECT * FROM ranked WHERE sample_rank=1 AND entry_output>0
     ), outcomes AS (
       SELECT s.*,
              CASE WHEN future.output_amount_raw>0
                   THEN round(10000*(s.entry_output/future.output_amount_raw-1))
                   ELSE NULL END AS gross_five_minute_bps
         FROM samples s
         LEFT JOIN LATERAL (
           SELECT o.output_amount_raw
             FROM paper_fast_market_observations o
            WHERE o.wallet=$1 AND o.token_mint=s.token_mint
              AND o.observed_at>=s.observed_at+interval '5 minutes'
              AND o.observed_at<=s.observed_at+interval '7 minutes'
            ORDER BY o.observed_at LIMIT 1
         ) future ON true
     )
     SELECT profile_id,stage,count(*)::int AS windows,
            count(DISTINCT token_mint)::int AS distinct_tokens,
            count(gross_five_minute_bps)::int AS matched,
            round(avg(gross_five_minute_bps),0)::int AS average_gross_bps,
            count(*) FILTER (WHERE gross_five_minute_bps>=200)::int AS gained_two_percent,
            count(*) FILTER (WHERE gross_five_minute_bps<=-200)::int AS lost_two_percent
       FROM outcomes GROUP BY profile_id,stage
       ORDER BY profile_id,CASE stage
         WHEN 'observed' THEN 1 WHEN 'pattern' THEN 2 WHEN 'market' THEN 3
         WHEN 'adaptive' THEN 4 ELSE 5 END`,
    [wallet],
  );
  return result.rows;
}

interface PipelineRow {
  readonly state: string;
  readonly available_at: Date | string;
  readonly lease_owner: string | null;
  readonly lease_expires_at: Date | string | null;
  readonly attempts: number;
  readonly payload_json: unknown;
  readonly last_error_json: unknown;
  readonly work_json: unknown;
}

/** Reports durable acquisition scheduling and downstream work without changing authority. */
export async function readAcquisitionPipelineStatus(
  database: Pick<Pool, "query">,
): Promise<AcquisitionPipelineStatus> {
  const result = await database.query<PipelineRow>(
    `SELECT schedule.state,schedule.available_at,schedule.lease_owner,schedule.lease_expires_at,
            schedule.attempts,schedule.payload_json,schedule.last_error_json,
            COALESCE((SELECT jsonb_agg(work ORDER BY work.job_type,work.state)
              FROM (SELECT job_type,state,count(*)::int AS count,
                           count(*) FILTER (WHERE last_error_json IS NOT NULL)::int AS retrying,
                           count(*) FILTER (WHERE job_type='candidate_evaluation'
                             AND payload_json->'screening'->>'outcome'='unavailable'
                             AND updated_at>=now()-interval '24 hours')::int AS screened_out_24h,
                           max(attempts)::int AS maximum_attempts,
                           max(COALESCE(last_error_json->>'reason',last_error_json->>'message')) AS last_error,
                           (array_agg(payload_json->'screening'->>'reason' ORDER BY updated_at DESC)
                             FILTER (WHERE payload_json->'screening'->>'reason' IS NOT NULL))[1] AS last_screening
                    FROM jobs
                    WHERE job_type IN ('candidate_evaluation','risk_evaluation','entry_planning','position_reconciliation')
                    GROUP BY job_type,state) work),'[]'::jsonb) AS work_json
     FROM jobs schedule WHERE schedule.job_type='candidate_acquisition'`,
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Acquisition schedule is unavailable");
  const work = Array.isArray(row.work_json) ? row.work_json : [];
  return Object.freeze({
    state: row.state,
    nextRunAt: timestamp(row.available_at),
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at === null ? null : timestamp(row.lease_expires_at),
    attempts: Number(row.attempts),
    lastResult: Object.freeze((row.payload_json ?? {}) as Record<string, unknown>),
    lastError:
      row.last_error_json === null
        ? null
        : Object.freeze(row.last_error_json as Record<string, unknown>),
    work: Object.freeze(
      work.map((item) =>
        Object.freeze({
          jobType: String((item as Record<string, unknown>).job_type),
          state: String((item as Record<string, unknown>).state),
          count: Number((item as Record<string, unknown>).count),
          retrying: Number((item as Record<string, unknown>).retrying ?? 0),
          maximumAttempts: Number((item as Record<string, unknown>).maximum_attempts ?? 0),
          screenedOutLast24Hours: Number((item as Record<string, unknown>).screened_out_24h ?? 0),
          lastScreeningReason:
            typeof (item as Record<string, unknown>).last_screening === "string"
              ? String((item as Record<string, unknown>).last_screening)
              : null,
          lastError:
            typeof (item as Record<string, unknown>).last_error === "string"
              ? String((item as Record<string, unknown>).last_error)
              : null,
        }),
      ),
    ),
  });
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
     ), profile_sequence AS (
       SELECT side,filled_at,id,settlement_amount_raw,execution_fee_raw,
              lag(side) OVER sequence AS previous_side,
              lag(settlement_amount_raw) OVER sequence AS entry_cost_raw
       FROM paper_profile_fills WHERE wallet=$1
       WINDOW sequence AS (PARTITION BY profile_id,token_mint ORDER BY filled_at,id)
     ), realized AS (
       SELECT realized_at AS occurred_at,realized_pnl_raw AS pnl,fill_id::text AS event_id
       FROM paper_realized_performance WHERE wallet=$1
       UNION ALL
       SELECT filled_at,settlement_amount_raw-entry_cost_raw-execution_fee_raw,id::text
       FROM profile_sequence WHERE side='sell' AND previous_side='buy'
     ), boundary AS (
       SELECT CASE WHEN $2::text IS NULL THEN opened_at
                   ELSE GREATEST(opened_at,now()-$2::interval) END AS starts_at
       FROM account
     ), eligible AS (
       SELECT p.occurred_at,p.pnl,
              row_number() OVER (ORDER BY p.occurred_at DESC,p.event_id DESC) AS recency
       FROM realized p,boundary b WHERE p.occurred_at>=b.starts_at
     ), events AS (
       SELECT occurred_at,pnl FROM eligible WHERE recency<=499
     ), baseline AS (
       SELECT COALESCE(min(e.occurred_at),b.starts_at) AS occurred_at,
              COALESCE((SELECT sum(p.pnl) FROM realized p WHERE p.occurred_at<b.starts_at),0)
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
         FROM (SELECT id,side,token_amount_raw::text,settlement_amount_raw::text,
                      execution_fee_raw::text,quoted_at,filled_at
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
                          AND r.state='pending') AS close_pending,
                      NULL::text AS profile_id,false AS profile_managed,NULL::text AS current_value_raw
               FROM paper_position_lots WHERE wallet=$1 AND current_amount_raw>0
               GROUP BY token_mint
               UNION ALL
               SELECT token_mint,token_amount_raw::text,cost_raw::text,opened_at,1,false,
                      profile_id,true,current_value_raw::text
                 FROM paper_profile_positions WHERE wallet=$1
               ORDER BY opened_at DESC, token_mint LIMIT 50) p),'[]') AS positions,
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
                      execution_fee_raw::text,quoted_at,filled_at,NULL::text AS profile_id,
                      CASE side WHEN 'buy' THEN 'approved_entry' ELSE 'position_exit' END AS reason,
                      NULL::text AS engine_version
               FROM paper_fills WHERE wallet=$1
               UNION ALL
               SELECT id,side,token_mint,token_amount_raw::text,settlement_amount_raw::text,
                      execution_fee_raw::text,quoted_at,filled_at,profile_id,reason,engine_version
                 FROM paper_profile_fills WHERE wallet=$1
               ORDER BY filled_at DESC,id LIMIT 500) f),'[]') AS fills,
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
