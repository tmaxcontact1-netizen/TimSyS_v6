import { Decimal } from "decimal.js";

import type { WalletConfirmation } from "../candidate/scoring.js";
import { InvariantViolationError } from "../shared/errors.js";
import type { DecimalValue, Timestamp } from "../shared/types.js";
import type { ConfirmingPurchase } from "./model.js";

export interface WalletConfirmationInput {
  readonly evaluatedAt: Timestamp;
  readonly currentPriceUsd: DecimalValue;
  readonly poolLiquidityUsd: DecimalValue;
  readonly purchases: readonly ConfirmingPurchase[];
}

function minutesBetween(later: Timestamp, earlier: Timestamp): number {
  return (Date.parse(later) - Date.parse(earlier)) / 60_000;
}

function qualifies(input: WalletConfirmationInput, purchase: ConfirmingPurchase): boolean {
  const age = minutesBetween(input.evaluatedAt, purchase.purchasedAt);
  const minimumPurchase = Decimal.min(input.poolLiquidityUsd.mul(0.0025), 500);
  return (
    age >= 0 &&
    age <= 10 &&
    purchase.observedAt <= input.evaluatedAt &&
    purchase.retainedPercentage.gte(70) &&
    purchase.purchaseValueUsd.gte(minimumPurchase) &&
    input.currentPriceUsd.lte(purchase.entryPriceUsd.mul(1.2)) &&
    purchase.evidence.length > 0
  );
}

/** Applies WAL-006 through WAL-011 and never treats Tier C as trading authority. */
export function classifyWalletConfirmation(input: WalletConfirmationInput): WalletConfirmation {
  if (input.currentPriceUsd.lte(0) || input.poolLiquidityUsd.lte(0))
    throw new InvariantViolationError("Wallet confirmation requires positive price and liquidity");
  const purchases = input.purchases.filter((purchase) => qualifies(input, purchase));
  if (purchases.some(({ tier }) => tier === "tier_a")) return "tier_a";
  const tierB = purchases.filter(({ tier }) => tier === "tier_b");
  for (let left = 0; left < tierB.length; left += 1) {
    for (let right = left + 1; right < tierB.length; right += 1) {
      const first = tierB[left]!;
      const second = tierB[right]!;
      if (
        first.walletId !== second.walletId &&
        first.independentGroupId !== second.independentGroupId &&
        Math.abs(minutesBetween(first.purchasedAt, second.purchasedAt)) <= 15
      )
        return "two_tier_b";
    }
  }
  return "none";
}
