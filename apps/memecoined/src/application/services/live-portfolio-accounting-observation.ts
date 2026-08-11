import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  type DecimalValue,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import type {
  PortfolioAccountingObservation,
  PortfolioAccountingObservationSource,
} from "./portfolio-accounting-producer.js";
import type { PortfolioInventoryValuation } from "./portfolio-inventory-valuation.js";
import {
  classifyPortfolioTransactionHistory,
  type PortfolioTransactionHistorySource,
} from "./portfolio-transaction-history.js";

export interface PortfolioOperationalSafetyObservation {
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly openCostExposureSol: DecimalValue;
  readonly liquidityCapacitySol: DecimalValue;
  readonly estimatedEntryCostsSol: DecimalValue;
  readonly openPositionCount: bigint;
  readonly executableUnrealizedLossSol: DecimalValue;
  readonly reconciliationFailuresLast24Hours: bigint;
  readonly authoritativeDisagreementDurationMs: bigint;
  readonly usesLeverageOrBorrowing: boolean;
}

export interface PortfolioInventoryValuationSource {
  observe(requestedAt: Timestamp): Promise<PortfolioInventoryValuation>;
}

export interface PortfolioOperationalSafetySource {
  observe(requestedAt: Timestamp): Promise<PortfolioOperationalSafetyObservation>;
}

function validateEvidence(
  evidence: readonly EvidenceReference[],
  observedAt: Timestamp,
): readonly EvidenceReference[] {
  if (evidence.length === 0)
    throw new InvariantViolationError("Live portfolio accounting requires complete evidence");
  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length)
    throw new InvariantViolationError("Live portfolio accounting evidence must be unique");
  if (evidence.some((item) => item.observedAt > observedAt))
    throw new InvariantViolationError("Live portfolio accounting evidence cannot be postdated");
  return Object.freeze([...evidence]);
}

/** Joins complete valuation, transaction, and operational authority at one instant. */
export class LivePortfolioAccountingObservationSource implements PortfolioAccountingObservationSource {
  public constructor(
    private readonly wallet: WalletAddress,
    private readonly valuation: PortfolioInventoryValuationSource,
    private readonly transactions: PortfolioTransactionHistorySource,
    private readonly operations: PortfolioOperationalSafetySource,
  ) {}

  public async observe(requestedAt: Timestamp): Promise<PortfolioAccountingObservation> {
    const [valuation, history, operations] = await Promise.all([
      this.valuation.observe(requestedAt),
      classifyPortfolioTransactionHistory({
        source: this.transactions,
        wallet: this.wallet,
        observedAt: requestedAt,
      }),
      this.operations.observe(requestedAt),
    ]);
    if (
      valuation.wallet !== this.wallet ||
      history.wallet !== this.wallet ||
      operations.wallet !== this.wallet
    )
      throw new InvariantViolationError("Live portfolio accounting returned a mismatched wallet");
    if (
      valuation.observedAt !== requestedAt ||
      history.observedAt !== requestedAt ||
      operations.observedAt !== requestedAt
    )
      throw new InvariantViolationError(
        "Live portfolio accounting authority must share one instant",
      );
    if (operations.liquidityCapacitySol.gt(valuation.nativeBalanceSol))
      throw new InvariantViolationError("Liquidity capacity cannot exceed the native balance");
    if (
      operations.openPositionCount === 0n &&
      (!operations.openCostExposureSol.isZero() || !operations.executableUnrealizedLossSol.isZero())
    )
      throw new InvariantViolationError("Flat operational authority cannot contain exposure");

    return Object.freeze({
      observedAt: requestedAt,
      evidence: validateEvidence(
        [...valuation.evidence, ...history.evidence, ...operations.evidence],
        requestedAt,
      ),
      equitySol: valuation.equitySol,
      uncommittedSol: valuation.nativeBalanceSol,
      openCostExposureSol: operations.openCostExposureSol,
      liquidityCapacitySol: operations.liquidityCapacitySol,
      estimatedEntryCostsSol: operations.estimatedEntryCostsSol,
      openPositionCount: operations.openPositionCount,
      cumulativeRealizedPnlSol: history.cumulativeRealizedPnlSol,
      executableUnrealizedLossSol: operations.executableUnrealizedLossSol,
      consecutiveClosedLosingTrades: history.consecutiveClosedLosingTrades,
      reconciliationFailuresLast24Hours: operations.reconciliationFailuresLast24Hours,
      unauthorizedTransactionDetected: history.unauthorizedTransactionDetected,
      authoritativeDisagreementDurationMs: operations.authoritativeDisagreementDurationMs,
      usesLeverageOrBorrowing: operations.usesLeverageOrBorrowing,
    });
  }
}
