import { Decimal } from "decimal.js";
import type { Pool, QueryResult } from "pg";

import type { SwapPort } from "../../application/ports/swap.js";
import type {
  RiskEvaluationFactSource,
  RiskEvaluationLease,
} from "../../application/services/risk-evaluation-work.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asBasisPoints,
  asNonNegativeDecimal,
  asRawAmount,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import { WRAPPED_SOL_MINT } from "../../application/services/portfolio-inventory-valuation.js";
import { PostgresRiskAuthorityRepository } from "./risk-authority.js";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface AccountRow extends Record<string, unknown> {
  readonly initial_cash_raw: string;
  readonly cash_raw: string;
  readonly open_cost_raw: string;
  readonly open_position_count: string;
  readonly mint_open_cost_raw: string;
  readonly last_closed_at: Date | string | null;
  readonly today_realized_loss_raw: string;
  readonly seven_day_realized_loss_raw: string;
  readonly all_realized_pnl_raw: string;
}

interface PositionRow extends Record<string, unknown> {
  readonly token_mint: string;
  readonly token_amount_raw: string;
  readonly cost_raw: string;
}

interface PerformanceRow extends Record<string, unknown> {
  readonly realized_pnl_raw: string;
}

const LAMPORTS_PER_SOL = new Decimal(1_000_000_000);

function sol(raw: bigint): Decimal {
  return new Decimal(raw.toString()).div(LAMPORTS_PER_SOL);
}

function iso(value: Date | string): Timestamp {
  return (value instanceof Date ? value : new Date(value)).toISOString() as Timestamp;
}

/**
 * Creates immutable paper risk authority from the durable simulated ledger and a
 * fresh executable quote. It has no signer, transaction construction, or submit path.
 */
export class PostgresPaperRiskAuthoritySource implements RiskEvaluationFactSource {
  private readonly snapshots: PostgresRiskAuthorityRepository;

  public constructor(
    private readonly database: Pick<Pool, "query">,
    private readonly wallet: WalletAddress,
    private readonly swap: Pick<SwapPort, "quote">,
    private readonly now: () => Timestamp,
  ) {
    this.snapshots = new PostgresRiskAuthorityRepository(database);
  }

  public async load(lease: RiskEvaluationLease) {
    try {
      return await this.snapshots.load(lease);
    } catch (error) {
      if (!(error instanceof InvariantViolationError)) throw error;
    }

    const observedAt = this.now();
    const account = await (this.database as DatabasePort).query<AccountRow>(
      `SELECT a.initial_cash_raw::text,
              (a.initial_cash_raw
               + COALESCE(sum(CASE e.event_type WHEN 'sell' THEN e.amount_raw ELSE -e.amount_raw END),0)
               - COALESCE((SELECT sum(execution_fee_raw) FROM paper_fills WHERE wallet=a.wallet),0))::text AS cash_raw,
              COALESCE((SELECT sum(remaining_cost_raw) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0),0)::text AS open_cost_raw,
              COALESCE((SELECT count(DISTINCT token_mint) FROM paper_position_lots WHERE wallet=a.wallet AND current_amount_raw>0),0)::text AS open_position_count,
              COALESCE((SELECT sum(remaining_cost_raw) FROM paper_position_lots WHERE wallet=a.wallet AND token_mint=$2 AND current_amount_raw>0),0)::text AS mint_open_cost_raw,
              (SELECT max(closed_at) FROM paper_position_lots WHERE wallet=a.wallet AND token_mint=$2 AND closed_at IS NOT NULL) AS last_closed_at,
              COALESCE((SELECT sum(GREATEST(-realized_pnl_raw,0)) FROM paper_realized_performance WHERE wallet=a.wallet AND realized_at >= date_trunc('day',$3::timestamptz)),0)::text AS today_realized_loss_raw,
              COALESCE((SELECT sum(GREATEST(-realized_pnl_raw,0)) FROM paper_realized_performance WHERE wallet=a.wallet AND realized_at >= $3::timestamptz-interval '7 days'),0)::text AS seven_day_realized_loss_raw,
              COALESCE((SELECT sum(realized_pnl_raw) FROM paper_realized_performance WHERE wallet=a.wallet),0)::text AS all_realized_pnl_raw
         FROM paper_accounts a LEFT JOIN paper_cash_events e ON e.wallet=a.wallet
        WHERE a.wallet=$1 GROUP BY a.wallet,a.initial_cash_raw`,
      [this.wallet, lease.mint, observedAt],
    );
    const row = account.rows[0];
    if (account.rowCount !== 1 || row === undefined)
      throw new InvariantViolationError("Paper account risk authority is unavailable");

    const positions = await (this.database as DatabasePort).query<PositionRow>(
      `SELECT token_mint, sum(current_amount_raw)::text AS token_amount_raw,
              sum(remaining_cost_raw)::text AS cost_raw
         FROM paper_position_lots
        WHERE wallet=$1 AND current_amount_raw>0 GROUP BY token_mint ORDER BY token_mint`,
      [this.wallet],
    );
    const recentPerformance = await (this.database as DatabasePort).query<PerformanceRow>(
      `SELECT realized_pnl_raw::text FROM paper_realized_performance
        WHERE wallet=$1 ORDER BY realized_at DESC,fill_id DESC LIMIT 100`,
      [this.wallet],
    );
    let consecutiveClosedLosingTrades = 0n;
    for (const performance of recentPerformance.rows) {
      if (BigInt(performance.realized_pnl_raw) >= 0n) break;
      consecutiveClosedLosingTrades += 1n;
    }
    let executablePositionValueRaw = 0n;
    let executableUnrealizedLossRaw = 0n;
    const positionEvidence: EvidenceReference[] = [];
    for (const position of positions.rows) {
      const exitQuote = await this.swap.quote({
        inputMint: position.token_mint as MintAddress,
        outputMint: WRAPPED_SOL_MINT,
        inputAmount: asRawAmount(BigInt(position.token_amount_raw)),
        slippageBasisPoints: asBasisPoints(150n),
        requestedAt: observedAt,
      });
      if (!exitQuote.ok)
        throw new InvariantViolationError(
          `Paper position valuation is unavailable: ${exitQuote.error.reason}`,
        );
      executablePositionValueRaw += exitQuote.value.expectedOutputAmount;
      executableUnrealizedLossRaw +=
        BigInt(position.cost_raw) > exitQuote.value.expectedOutputAmount
          ? BigInt(position.cost_raw) - exitQuote.value.expectedOutputAmount
          : 0n;
      positionEvidence.push(...exitQuote.value.evidence);
    }

    const cashRaw = BigInt(row.cash_raw);
    const openCostRaw = BigInt(row.open_cost_raw);
    const executableEquityRaw = cashRaw + executablePositionValueRaw;
    const requestedRaw = executableEquityRaw / 30n;
    if (requestedRaw <= 0n)
      throw new InvariantViolationError("Paper equity is too small for an executable risk quote");
    const quoted = await this.swap.quote({
      inputMint: WRAPPED_SOL_MINT,
      outputMint: lease.mint,
      inputAmount: asRawAmount(requestedRaw),
      slippageBasisPoints: asBasisPoints(150n),
      requestedAt: observedAt,
    });
    if (!quoted.ok)
      throw new InvariantViolationError(`Paper liquidity authority is unavailable: ${quoted.error.reason}`);
    const evidence = Object.freeze([...positionEvidence, ...quoted.value.evidence]);
    if (evidence.length === 0)
      throw new InvariantViolationError("Paper liquidity quote has no evidence");

    const initial = sol(BigInt(row.initial_cash_raw));
    const realizedPnl = sol(BigInt(row.all_realized_pnl_raw));
    const equity = sol(executableEquityRaw);
    const highWater = Decimal.max(initial, initial.plus(realizedPnl), equity);
    const drawdown = highWater.isZero()
      ? new Decimal(0)
      : Decimal.max(highWater.minus(equity), 0).div(highWater).mul(100);
    const sevenDayDrawdown = initial.isZero()
      ? new Decimal(0)
      : sol(BigInt(row.seven_day_realized_loss_raw)).div(initial).mul(100);
    const lastClosedAt = row.last_closed_at === null ? null : iso(row.last_closed_at);

    const snapshotAt = this.now();
    await this.snapshots.recordIfAbsent({
      signalId: lease.signalId,
      mint: lease.mint,
      observedAt: snapshotAt,
      evidence,
      portfolio: {
        equitySol: asNonNegativeDecimal(equity),
        uncommittedSol: asNonNegativeDecimal(sol(cashRaw)),
        openCostExposureSol: asNonNegativeDecimal(sol(openCostRaw)),
        liquidityCapacitySol: asNonNegativeDecimal(sol(quoted.value.inputAmount)),
        estimatedEntryCostsSol: asNonNegativeDecimal(0),
        openPositionCount: BigInt(row.open_position_count),
        hasNonClosedPositionForMint: BigInt(row.mint_open_cost_raw) > 0n,
        hasConfirmedPriorClosure: lastClosedAt !== null,
        lastConfirmedClosureAt: lastClosedAt,
        usesLeverageOrBorrowing: false,
        increasesLosingPosition: false,
        requestedPositionPercentage: null,
      },
      breakers: {
        utcDayStartingEquitySol: asNonNegativeDecimal(
          Decimal.max(equity.plus(sol(BigInt(row.today_realized_loss_raw))), 0),
        ),
        dailyRealizedLossSol: asNonNegativeDecimal(sol(BigInt(row.today_realized_loss_raw))),
        executableUnrealizedLossSol: asNonNegativeDecimal(sol(executableUnrealizedLossRaw)),
        rollingSevenDayDrawdownPercentage: asNonNegativeDecimal(sevenDayDrawdown),
        highWaterDrawdownPercentage: asNonNegativeDecimal(drawdown),
        consecutiveClosedLosingTrades,
        reconciliationFailuresLast24Hours: 0n,
        unauthorizedTransactionDetected: false,
        authoritativeDisagreementDurationMs: 0n,
      },
    });
    return this.snapshots.load(lease);
  }
}
