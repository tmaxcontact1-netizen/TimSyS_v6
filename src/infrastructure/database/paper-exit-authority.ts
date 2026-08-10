import { createHash } from "node:crypto";
import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import type { SwapPort } from "../../application/ports/swap.js";
import type { PaperExitAuthoritySource } from "../../application/services/paper-exit-authority.js";
import { WRAPPED_SOL_MINT } from "../../application/services/portfolio-inventory-valuation.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import { evaluateExit, type ExitDecision } from "../../domain/trading/exits.js";
import {
  asBasisPoints,
  asDecimal,
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

const LAMPORTS_PER_SOL = new Decimal(1_000_000_000);

function uuid(kind: string, wallet: string, mint: string): string {
  const value = createHash("sha256").update([kind, wallet, mint].join("\0")).digest("hex");
  return asUuid(
    `${value.slice(0, 8)}-${value.slice(8, 12)}-5${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`,
  );
}

export class PostgresPaperExitAuthority implements PaperExitAuthoritySource {
  public constructor(
    private readonly database: Pick<Pool, "query">,
    private readonly wallet: WalletAddress,
    private readonly swaps: Pick<SwapPort, "quote">,
    private readonly now: () => Timestamp,
  ) {}

  public async evaluate(input: {
    tokenMint: MintAddress;
    openAmountRaw: bigint;
    evaluatedAt: Timestamp;
  }): Promise<Readonly<{ decision: ExitDecision; evaluatedAt: Timestamp }>> {
    const operatorClose = await this.database.query<{ expected_open_amount_raw: string }>(
      `SELECT expected_open_amount_raw::text FROM paper_position_close_requests
       WHERE wallet=$1 AND token_mint=$2 AND state='pending' LIMIT 1`,
      [this.wallet, input.tokenMint],
    );
    const state = await this.database.query<{
      original_amount_raw: string;
      current_amount_raw: string;
      original_cost_raw: string;
      remaining_cost_raw: string;
      opened_at: Date | string;
      first_target: boolean;
      second_target: boolean;
      peak_value_sol: string | null;
    }>(
      `SELECT sum(acquired_amount_raw)::text AS original_amount_raw,
              sum(current_amount_raw)::text AS current_amount_raw,
              sum(cost_raw)::text AS original_cost_raw,
              sum(remaining_cost_raw)::text AS remaining_cost_raw,min(opened_at) AS opened_at,
              EXISTS (SELECT 1 FROM paper_exit_evaluations e WHERE e.wallet=$1 AND e.token_mint=$2 AND e.rule_id='EXT-002') AS first_target,
              EXISTS (SELECT 1 FROM paper_exit_evaluations e WHERE e.wallet=$1 AND e.token_mint=$2 AND e.rule_id='EXT-003') AS second_target,
              (SELECT max(executable_value_sol)::text FROM paper_exit_evaluations e WHERE e.wallet=$1 AND e.token_mint=$2) AS peak_value_sol
       FROM paper_position_lots WHERE wallet=$1 AND token_mint=$2`,
      [this.wallet, input.tokenMint],
    );
    const row = state.rows[0];
    if (row === undefined || BigInt(row.current_amount_raw) !== input.openAmountRaw)
      throw new InvariantViolationError("Paper exit authority does not match the leased inventory");
    const quoteResult = await this.swaps.quote({
      inputMint: input.tokenMint,
      outputMint: WRAPPED_SOL_MINT,
      inputAmount: asRawAmount(input.openAmountRaw),
      slippageBasisPoints: asBasisPoints(150n),
      requestedAt: input.evaluatedAt,
    });
    if (!quoteResult.ok)
      throw new InvariantViolationError(
        `Paper exit authority quote unavailable: ${quoteResult.error.code}`,
      );
    const quote = quoteResult.value;
    if (
      quote.inputMint !== input.tokenMint ||
      quote.outputMint !== WRAPPED_SOL_MINT ||
      quote.inputAmount !== input.openAmountRaw ||
      quote.requestedAt !== input.evaluatedAt ||
      quote.evidence.length === 0
    )
      throw new InvariantViolationError("Paper exit authority quote does not match the position");
    const authorityAt = this.now();
    if (authorityAt < quote.receivedAt || authorityAt < input.evaluatedAt)
      throw new InvariantViolationError("Paper exit authority cannot predate its evidence");
    const executable = asNonNegativeDecimal(
      new Decimal(quote.expectedOutputAmount.toString()).div(LAMPORTS_PER_SOL),
    );
    const openedAt = asTimestamp(new Date(row.opened_at).toISOString());
    const cost = asNonNegativeDecimal(new Decimal(row.remaining_cost_raw).div(LAMPORTS_PER_SOL));
    const deterministicDecision = evaluateExit(
      {
        id: uuid("paper-position", this.wallet, input.tokenMint) as never,
        tokenId: uuid("paper-token", this.wallet, input.tokenMint) as never,
        entryOrderId: uuid("paper-entry", this.wallet, input.tokenMint) as never,
        state:
          input.openAmountRaw === BigInt(row.original_amount_raw) ? "open" : "partially_closed",
        originalAmount: asRawAmount(BigInt(row.original_amount_raw)),
        currentAmount: asRawAmount(input.openAmountRaw),
        originalCostBasisSol: asNonNegativeDecimal(
          new Decimal(row.original_cost_raw).div(LAMPORTS_PER_SOL),
        ),
        remainingCostBasisSol: cost,
        realisedPnlSol: asDecimal("0"),
        peakExecutableValueSol: asNonNegativeDecimal(
          Decimal.max(executable, new Decimal(row.peak_value_sol ?? "0")),
        ),
        firstTargetSatisfied: row.first_target,
        secondTargetSatisfied: row.second_target,
        lots: Object.freeze([]),
        openedAt,
        closedAt: null,
        updatedAt: openedAt,
        version: 0n,
      },
      {
        evaluatedAt: authorityAt,
        executableValueSol: executable,
        evidence: quote.evidence,
        emergency: {
          evaluatedAt: authorityAt,
          liquidityUsd: null,
          liquidityUsdTenMinutesAgo: null,
          developerRelatedSoldPercentage: null,
          originatingTierASoldPercentage: null,
          confirmingTierBSoldPercentages: null,
          dangerousSecurityChangeDetected: null,
          fullExitPriceImpactPercentages: null,
          unexplainedBalanceDiscrepancy: null,
          marketDataUnavailableSince: null,
          marketDataAvailabilityKnown: false,
          allChainAccessUnavailableSince: null,
          chainAccessAvailabilityKnown: false,
          evidence: quote.evidence,
        },
      },
    );
    const closeRequested = operatorClose.rows[0];
    if (
      closeRequested !== undefined &&
      input.openAmountRaw > BigInt(closeRequested.expected_open_amount_raw)
    )
      throw new InvariantViolationError("Paper close request does not match leased inventory");
    const decision: ExitDecision =
      closeRequested === undefined
        ? deterministicDecision
        : Object.freeze({
            action: "full",
            requestedAmount: asRawAmount(input.openAmountRaw),
            ruleId: "OPERATOR-PAPER-CLOSE",
            results: deterministicDecision.results,
          });
    await this.database.query(
      `INSERT INTO paper_exit_evaluations
       (id,wallet,token_mint,evaluated_at,open_amount_raw,executable_value_sol,action,rule_id,requested_amount_raw,evidence_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT DO NOTHING`,
      [
        uuid(`paper-exit:${authorityAt}`, this.wallet, input.tokenMint),
        this.wallet,
        input.tokenMint,
        authorityAt,
        input.openAmountRaw.toString(),
        executable.toString(),
        decision.action,
        decision.ruleId,
        decision.requestedAmount.toString(),
        JSON.stringify(quote.evidence, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ],
    );
    return Object.freeze({ decision, evaluatedAt: authorityAt });
  }
}
