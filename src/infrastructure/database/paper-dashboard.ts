import type { Pool } from "pg";

import type { WalletAddress } from "../../domain/shared/types.js";

export interface PaperDashboardDetails {
  readonly positions: readonly Record<string, unknown>[];
  readonly fills: readonly Record<string, unknown>[];
  readonly performance: readonly Record<string, unknown>[];
  readonly events: readonly Record<string, unknown>[];
}

interface DashboardRow {
  readonly positions: unknown;
  readonly fills: unknown;
  readonly performance: unknown;
  readonly events: unknown;
}

function rows(value: unknown, label: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "object" || item === null))
    throw new Error(`Invalid paper dashboard ${label}`);
  return Object.freeze(value.map((item) => Object.freeze(item as Record<string, unknown>)));
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
                      count(*)::int AS lots
               FROM paper_position_lots WHERE wallet=$1 AND current_amount_raw>0
               GROUP BY token_mint ORDER BY min(opened_at) DESC, token_mint LIMIT 50) p),'[]') AS positions,
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
    fills: rows(row.fills, "fills"),
    performance: rows(row.performance, "performance"),
    events: rows(row.events, "events"),
  });
}
