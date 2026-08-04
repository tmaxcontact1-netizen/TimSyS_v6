import { Decimal } from "decimal.js";

import { createRuleResult, type RuleMeasurement, type RuleResult } from "../shared/evidence.js";
import { asDecimal, asRuleId } from "../shared/types.js";
import type { MarketSnapshot } from "./model.js";

export interface MarketDecision {
  readonly eligible: boolean;
  readonly results: readonly RuleResult[];
  readonly failedRuleIds: readonly string[];
}

function measurement(
  name: string,
  value: Decimal | bigint | boolean | string | null,
  unit?: string,
): RuleMeasurement {
  return {
    name,
    value: value instanceof Decimal ? asDecimal(value) : value,
    ...(unit ? { unit } : {}),
  };
}

function rule(
  snapshot: MarketSnapshot,
  id: string,
  passes: boolean,
  reason: string,
  measurements: readonly RuleMeasurement[],
): RuleResult {
  return createRuleResult({
    ruleId: asRuleId(id),
    outcome: passes ? "pass" : "fail",
    evaluatedAt: snapshot.observedAt,
    evidence: snapshot.evidence,
    measurements,
    reason,
  });
}

function between(value: Decimal | null, minimum: Decimal.Value, maximum: Decimal.Value): boolean {
  return value !== null && value.gte(minimum) && value.lte(maximum);
}

function atLeast(value: Decimal | null, minimum: Decimal.Value): boolean {
  return value !== null && value.gte(minimum);
}

function declinePercentage(current: Decimal | null, previous: Decimal | null): Decimal | null {
  if (current === null || previous === null || previous.lte(0)) return null;
  return previous.minus(current).div(previous).mul(100);
}

export function evaluateMarket(snapshot: MarketSnapshot): MarketDecision {
  const liquidityDecline = declinePercentage(
    snapshot.liquidityUsd,
    snapshot.liquidityUsdFifteenMinutesAgo,
  );
  const volumeThreshold = snapshot.precedingOneHourVolumeUsd?.mul("0.20") ?? null;
  const buySellRatio =
    snapshot.fiveMinuteBuyTransactions !== null &&
    snapshot.fiveMinuteSellTransactions !== null &&
    snapshot.fiveMinuteSellTransactions > 0n
      ? new Decimal(snapshot.fiveMinuteBuyTransactions.toString()).div(
          snapshot.fiveMinuteSellTransactions.toString(),
        )
      : null;
  const noMarketRejection =
    atLeast(snapshot.liquidityUsd, 75_000) &&
    between(snapshot.poolAgeMinutes, 30, 43_200) &&
    between(snapshot.marketCapitalizationUsd, 250_000, 20_000_000) &&
    liquidityDecline !== null &&
    liquidityDecline.lt(15) &&
    snapshot.fiveMinuteBuyTransactions !== null &&
    snapshot.fiveMinuteSellTransactions !== null &&
    snapshot.fiveMinuteSellTransactions <= snapshot.fiveMinuteBuyTransactions;
  const zeroSellPass =
    snapshot.fiveMinuteSellTransactions === 0n &&
    snapshot.fiveMinuteUniqueBuyers !== null &&
    snapshot.fiveMinuteUniqueBuyers >= 25n &&
    noMarketRejection;
  const drawdown = declinePercentage(
    snapshot.currentExecutablePriceUsd,
    snapshot.fiveMinuteExecutableHighUsd,
  );
  const entryPremium =
    snapshot.currentExecutablePriceUsd !== null &&
    snapshot.confirmingWalletVolumeWeightedEntryUsd !== null &&
    snapshot.confirmingWalletVolumeWeightedEntryUsd.gt(0)
      ? snapshot.currentExecutablePriceUsd
          .minus(snapshot.confirmingWalletVolumeWeightedEntryUsd)
          .div(snapshot.confirmingWalletVolumeWeightedEntryUsd)
          .mul(100)
      : null;

  const results = Object.freeze([
    rule(
      snapshot,
      "UNI-001",
      snapshot.chain === "solana" && snapshot.quoteAsset === "SOL",
      "Pool must be on Solana and quoted in SOL",
      [measurement("chain", snapshot.chain), measurement("quote_asset", snapshot.quoteAsset)],
    ),
    rule(
      snapshot,
      "UNI-002",
      between(snapshot.poolAgeMinutes, 30, 43_200),
      "Pool age must be 30 minutes through 30 days inclusive",
      [measurement("pool_age", snapshot.poolAgeMinutes, "minutes")],
    ),
    rule(
      snapshot,
      "UNI-003",
      between(snapshot.marketCapitalizationUsd, 250_000, 20_000_000),
      "Market capitalization must be $250,000 through $20,000,000 inclusive",
      [measurement("market_capitalization", snapshot.marketCapitalizationUsd, "USD")],
    ),
    rule(
      snapshot,
      "UNI-004",
      atLeast(snapshot.liquidityUsd, 75_000),
      "Liquidity must be at least $75,000",
      [measurement("liquidity", snapshot.liquidityUsd, "USD")],
    ),
    rule(
      snapshot,
      "SEC-005",
      atLeast(snapshot.liquidityUsd, 75_000),
      "Liquidity below $75,000 is rejected",
      [measurement("liquidity", snapshot.liquidityUsd, "USD")],
    ),
    rule(
      snapshot,
      "SEC-006",
      between(snapshot.poolAgeMinutes, 30, 43_200),
      "Pool age outside 30 minutes through 30 days is rejected",
      [measurement("pool_age", snapshot.poolAgeMinutes, "minutes")],
    ),
    rule(
      snapshot,
      "SEC-007",
      between(snapshot.marketCapitalizationUsd, 250_000, 20_000_000),
      "Market capitalization outside the permitted range is rejected",
      [measurement("market_capitalization", snapshot.marketCapitalizationUsd, "USD")],
    ),
    rule(
      snapshot,
      "SEC-011",
      liquidityDecline !== null && liquidityDecline.lt(15),
      "A liquidity decline of at least 15% is rejected",
      [measurement("liquidity_decline", liquidityDecline, "percent")],
    ),
    rule(
      snapshot,
      "SEC-012",
      snapshot.fiveMinuteBuyTransactions !== null &&
        snapshot.fiveMinuteSellTransactions !== null &&
        snapshot.fiveMinuteSellTransactions <= snapshot.fiveMinuteBuyTransactions,
      "Sell transaction count must not exceed buy transaction count",
      [
        measurement("buy_transactions", snapshot.fiveMinuteBuyTransactions),
        measurement("sell_transactions", snapshot.fiveMinuteSellTransactions),
      ],
    ),
    rule(
      snapshot,
      "MOM-001",
      between(snapshot.fiveMinutePriceChange, 3, 18),
      "Five-minute price change must be +3% through +18%",
      [measurement("five_minute_price_change", snapshot.fiveMinutePriceChange, "percent")],
    ),
    rule(
      snapshot,
      "MOM-002",
      between(snapshot.oneHourPriceChange, 8, 60),
      "One-hour price change must be +8% through +60%",
      [measurement("one_hour_price_change", snapshot.oneHourPriceChange, "percent")],
    ),
    rule(
      snapshot,
      "MOM-003",
      atLeast(snapshot.fiveMinuteVolumeUsd, 20_000),
      "Five-minute volume must be at least $20,000",
      [measurement("five_minute_volume", snapshot.fiveMinuteVolumeUsd, "USD")],
    ),
    rule(
      snapshot,
      "MOM-004",
      snapshot.fiveMinuteVolumeUsd !== null &&
        volumeThreshold !== null &&
        snapshot.fiveMinuteVolumeUsd.gte(volumeThreshold),
      "Five-minute volume must be at least 20% of the preceding one-hour volume",
      [
        measurement("five_minute_volume", snapshot.fiveMinuteVolumeUsd, "USD"),
        measurement("required_volume", volumeThreshold, "USD"),
      ],
    ),
    rule(
      snapshot,
      "MOM-005",
      zeroSellPass || (buySellRatio !== null && buySellRatio.gte("1.3")),
      "Buy/sell count ratio must be at least 1.3; zero sells requires 25 buyers and no market rejection",
      [
        measurement("buy_sell_ratio", buySellRatio),
        measurement("zero_sell_exception", zeroSellPass),
      ],
    ),
    rule(
      snapshot,
      "MOM-006",
      snapshot.fiveMinuteUniqueBuyers !== null && snapshot.fiveMinuteUniqueBuyers >= 25n,
      "At least 25 unique buyers are required",
      [measurement("unique_buyers", snapshot.fiveMinuteUniqueBuyers)],
    ),
    rule(
      snapshot,
      "MOM-007",
      snapshot.largestBuyerVolumePercentage !== null &&
        snapshot.largestBuyerVolumePercentage.lte(20),
      "No wallet may supply more than 20% of five-minute buy volume",
      [measurement("largest_buyer_volume", snapshot.largestBuyerVolumePercentage, "percent")],
    ),
    rule(
      snapshot,
      "MOM-008",
      drawdown !== null && drawdown.lte(12),
      "Current executable price must be no more than 12% below the five-minute high",
      [measurement("drawdown_from_high", drawdown, "percent")],
    ),
    rule(
      snapshot,
      "MOM-009",
      entryPremium !== null && entryPremium.lte(20),
      "Current executable price must be no more than 20% above confirming wallets' weighted entry",
      [measurement("premium_to_wallet_entry", entryPremium, "percent")],
    ),
    rule(
      snapshot,
      "MOM-010",
      liquidityDecline !== null && liquidityDecline.lt(1),
      "Liquidity must be stable or increasing; decline must be below 1%",
      [measurement("liquidity_decline", liquidityDecline, "percent")],
    ),
  ]);

  const failedRuleIds = Object.freeze(
    results.filter(({ outcome }) => outcome === "fail").map(({ ruleId }) => ruleId as string),
  );
  return Object.freeze({ eligible: failedRuleIds.length === 0, results, failedRuleIds });
}
