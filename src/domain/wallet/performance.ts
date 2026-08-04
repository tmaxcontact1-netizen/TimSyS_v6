import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../shared/errors.js";
import type { WalletPerformanceSnapshot, WalletQualification, WalletTier } from "./model.js";

function validate(snapshot: WalletPerformanceSnapshot): void {
  if (snapshot.completedTrades < 0n)
    throw new InvariantViolationError("Completed trades cannot be negative");
  if (snapshot.profitFactor.isNegative())
    throw new InvariantViolationError("Profit factor cannot be negative");
  if (snapshot.medianHoldingMinutes.isNegative())
    throw new InvariantViolationError("Median holding period cannot be negative");
  if (snapshot.evidence.length === 0)
    throw new InvariantViolationError("Wallet qualification requires evidence");
  if (new Set(snapshot.manipulationFlags).size !== snapshot.manipulationFlags.length)
    throw new InvariantViolationError("Manipulation flags must be unique");
}

/** Applies WAL-001 through WAL-005; every stronger tier also satisfies base eligibility. */
export function qualifyWallet(snapshot: WalletPerformanceSnapshot): WalletQualification {
  validate(snapshot);
  const reasons: string[] = [];
  if (snapshot.completedTrades < 30n) reasons.push("fewer than 30 completed trades");
  if (snapshot.winRate.lt(55)) reasons.push("win rate below 55%");
  if (snapshot.profitFactor.lt(1.5)) reasons.push("profit factor below 1.5");
  if (snapshot.medianReturnPercentage.lte(8)) reasons.push("median return is not above 8%");
  if (!snapshot.totalRealisedProfitUsd.gt(0)) reasons.push("realised profit is not positive");
  if (snapshot.verifiableTradePercentage.lt(60))
    reasons.push("fewer than 60% of trades are verifiable");
  if (snapshot.medianHoldingMinutes.lt(5) || snapshot.medianHoldingMinutes.gt(1_440))
    reasons.push("median holding period is outside 5 minutes to 24 hours");
  if (snapshot.maximumDrawdownPercentage.gt(35)) reasons.push("maximum drawdown exceeds 35%");
  if (snapshot.manipulationFlags.length > 0)
    reasons.push("disqualifying manipulation evidence exists");

  let tier: WalletTier = "ineligible";
  if (reasons.length === 0) {
    tier =
      snapshot.completedTrades >= 100n &&
      snapshot.winRate.gte(60) &&
      snapshot.profitFactor.gte(new Decimal(2))
        ? "tier_a"
        : snapshot.completedTrades >= 50n &&
            snapshot.winRate.gte(57) &&
            snapshot.profitFactor.gte(new Decimal(1.7))
          ? "tier_b"
          : "tier_c";
  }
  return Object.freeze({
    walletId: snapshot.walletId,
    tier,
    eligible: tier !== "ineligible",
    reasons: Object.freeze(reasons),
    evaluatedAt: snapshot.evaluatedAt,
    evidence: Object.freeze([...snapshot.evidence]),
  });
}
