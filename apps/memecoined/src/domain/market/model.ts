import { InvariantViolationError } from "../shared/errors.js";
import type { EvidenceReference } from "../shared/evidence.js";
import {
  asNonNegativeDecimal,
  type DecimalValue,
  type Percentage,
  type Timestamp,
} from "../shared/types.js";

export type Chain = "solana" | "unknown";
export type QuoteAsset = "SOL" | "other" | "unknown";

export interface MarketSnapshot {
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly chain: Chain;
  readonly quoteAsset: QuoteAsset;
  readonly poolAgeMinutes: DecimalValue | null;
  readonly marketCapitalizationUsd: DecimalValue | null;
  readonly liquidityUsd: DecimalValue | null;
  readonly liquidityUsdFifteenMinutesAgo: DecimalValue | null;
  readonly fiveMinutePriceChange: Percentage | null;
  readonly oneHourPriceChange: Percentage | null;
  readonly fiveMinuteVolumeUsd: DecimalValue | null;
  readonly precedingOneHourVolumeUsd: DecimalValue | null;
  readonly fiveMinuteBuyTransactions: bigint | null;
  readonly fiveMinuteSellTransactions: bigint | null;
  readonly fiveMinuteUniqueBuyers: bigint | null;
  readonly largestBuyerVolumePercentage: Percentage | null;
  readonly currentExecutablePriceUsd: DecimalValue | null;
  readonly fiveMinuteExecutableHighUsd: DecimalValue | null;
  readonly confirmingWalletVolumeWeightedEntryUsd: DecimalValue | null;
}

function requireNonNegative(value: DecimalValue | null, name: string): void {
  if (value !== null && value.isNegative()) {
    throw new InvariantViolationError(`${name} must be non-negative`);
  }
}

function requireNonNegativeCount(value: bigint | null, name: string): void {
  if (value !== null && value < 0n) {
    throw new InvariantViolationError(`${name} must be non-negative`);
  }
}

export function createMarketSnapshot(input: MarketSnapshot): MarketSnapshot {
  requireNonNegative(input.poolAgeMinutes, "Pool age");
  requireNonNegative(input.marketCapitalizationUsd, "Market capitalization");
  requireNonNegative(input.liquidityUsd, "Liquidity");
  requireNonNegative(input.liquidityUsdFifteenMinutesAgo, "Previous liquidity");
  requireNonNegative(input.fiveMinuteVolumeUsd, "Five-minute volume");
  requireNonNegative(input.precedingOneHourVolumeUsd, "Preceding one-hour volume");
  requireNonNegative(input.currentExecutablePriceUsd, "Current executable price");
  requireNonNegative(input.fiveMinuteExecutableHighUsd, "Five-minute executable high");
  requireNonNegative(
    input.confirmingWalletVolumeWeightedEntryUsd,
    "Confirming-wallet weighted entry",
  );
  requireNonNegativeCount(input.fiveMinuteBuyTransactions, "Buy transaction count");
  requireNonNegativeCount(input.fiveMinuteSellTransactions, "Sell transaction count");
  requireNonNegativeCount(input.fiveMinuteUniqueBuyers, "Unique buyer count");

  if (input.evidence.length === 0) {
    throw new InvariantViolationError("Market snapshot requires source evidence");
  }
  if (
    input.currentExecutablePriceUsd !== null &&
    input.fiveMinuteExecutableHighUsd !== null &&
    input.currentExecutablePriceUsd.gt(input.fiveMinuteExecutableHighUsd)
  ) {
    throw new InvariantViolationError("Current price cannot exceed the five-minute high");
  }

  return Object.freeze({ ...input, evidence: Object.freeze([...input.evidence]) });
}

export const usd = asNonNegativeDecimal;
