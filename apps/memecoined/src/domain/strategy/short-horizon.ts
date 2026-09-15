import type { TradingProfileId } from "./profiles.js";

export interface ExecutableMarketPoint {
  readonly observedAt: string;
  readonly outputAmountRaw: bigint;
  readonly liquidityUsd?: string | null;
  readonly fiveMinuteVolumeUsd?: string | null;
  readonly fiveMinuteBuys?: bigint | null;
  readonly fiveMinuteSells?: bigint | null;
}

export interface ShortHorizonSignal {
  readonly eligible: boolean;
  readonly pattern: "insufficient_history" | "momentum" | "pullback_rebound" | "range_rebound" | "trend" | "none";
  readonly latestMoveBps: number;
  readonly shortMoveBps: number;
  readonly cumulativeMoveBps: number;
  readonly observedVolatilityBps: number;
  readonly positiveSteps: number;
  readonly drawdownFromHighBps: number;
  readonly volumeChangeBps: number | null;
  readonly liquidityChangeBps: number | null;
  readonly buyPressureBps: number | null;
  readonly marketConfirmed: boolean;
  readonly reason: string;
}

const priceMoveBps = (olderOutput: bigint, newerOutput: bigint): number => {
  if (olderOutput <= 0n || newerOutput <= 0n) return 0;
  return Number((olderOutput * 10_000n) / newerOutput - 10_000n);
};

const decimalChangeBps = (older: string | null | undefined, newer: string | null | undefined) => {
  if (older == null || newer == null) return null;
  const left = Number(older), right = Number(newer);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right < 0) return null;
  return Math.round(((right - left) / left) * 10_000);
};

const pressureBps = (buys: bigint | null | undefined, sells: bigint | null | undefined) => {
  if (buys == null || sells == null || buys + sells <= 0n) return null;
  return Number((buys * 10_000n) / (buys + sells));
};

const insufficient = (): ShortHorizonSignal => Object.freeze({
  eligible: false, pattern: "insufficient_history", latestMoveBps: 0, shortMoveBps: 0,
  cumulativeMoveBps: 0, observedVolatilityBps: 0, positiveSteps: 0,
  drawdownFromHighBps: 0, volumeChangeBps: null, liquidityChangeBps: null,
  buyPressureBps: null, marketConfirmed: false,
  reason: "Six executable observations are required for multi-horizon analysis",
});

/** Builds executable micro-bars and confirms them with independent market activity. */
export function evaluateShortHorizonSignal(
  profileId: TradingProfileId,
  points: readonly ExecutableMarketPoint[],
): ShortHorizonSignal {
  if (points.length < 6) return insufficient();
  const recent = points.slice(-6);
  const moves = recent.slice(1).map((point, index) =>
    priceMoveBps(recent[index]!.outputAmountRaw, point.outputAmountRaw));
  const latest = moves.at(-1) ?? 0;
  const short = priceMoveBps(recent.at(-3)!.outputAmountRaw, recent.at(-1)!.outputAmountRaw);
  const cumulative = priceMoveBps(recent[0]!.outputAmountRaw, recent.at(-1)!.outputAmountRaw);
  const positiveSteps = moves.filter((move) => move > 0).length;
  const minimumOutput = recent.reduce((value, point) =>
    point.outputAmountRaw < value ? point.outputAmountRaw : value, recent[0]!.outputAmountRaw);
  const maximumOutput = recent.reduce((value, point) =>
    point.outputAmountRaw > value ? point.outputAmountRaw : value, recent[0]!.outputAmountRaw);
  const volatility = Math.max(0, priceMoveBps(maximumOutput, minimumOutput));
  const drawdown = Math.max(0, -priceMoveBps(minimumOutput, recent.at(-1)!.outputAmountRaw));
  const volumeChange = decimalChangeBps(recent.at(-3)!.fiveMinuteVolumeUsd, recent.at(-1)!.fiveMinuteVolumeUsd);
  const liquidityChange = decimalChangeBps(recent[0]!.liquidityUsd, recent.at(-1)!.liquidityUsd);
  const buyPressure = pressureBps(recent.at(-1)!.fiveMinuteBuys, recent.at(-1)!.fiveMinuteSells);
  const marketConfirmed = volumeChange !== null && liquidityChange !== null && buyPressure !== null &&
    volumeChange >= -2_000 && liquidityChange >= -200 && buyPressure >= 5_000;
  const momentum = latest >= 8 && latest <= 350 && short >= 20 && cumulative >= 35 &&
    positiveSteps >= 3 && drawdown <= 35;
  const trend = cumulative >= 50 && cumulative <= 700 && positiveSteps >= 4 && drawdown <= 30;
  const pullbackRebound = moves.slice(0, -1).some((move) => move <= -15 && move >= -400) &&
    latest >= 15 && short >= 15 && drawdown <= 45;
  const rangeRebound = volatility >= 35 && volatility <= 350 &&
    moves.slice(0, -1).some((move) => move < 0) && latest >= 10 && short > 0 && drawdown <= 30;
  const pattern = trend ? "trend" : momentum ? "momentum" : pullbackRebound
    ? "pullback_rebound" : rangeRebound ? "range_rebound" : "none";
  const permittedPattern = profileId === "fast_furious" ? momentum || pullbackRebound
    : profileId === "scalper" ? rangeRebound || pullbackRebound || (momentum && latest <= 180)
      : profileId === "trend_detector" ? trend
        : profileId === "breakout_retest" || profileId === "recovery_reversal" ? pullbackRebound : false;
  const profileConfirmation = profileId === "trend_detector"
    ? marketConfirmed && (volumeChange ?? -Infinity) >= -500 && (liquidityChange ?? -Infinity) >= -100
    : profileId === "scalper" ? marketConfirmed && (volumeChange ?? -Infinity) >= -1_000 : marketConfirmed;
  const eligible = permittedPattern && profileConfirmation;
  return Object.freeze({
    eligible, pattern, latestMoveBps: latest, shortMoveBps: short,
    cumulativeMoveBps: cumulative, observedVolatilityBps: volatility, positiveSteps,
    drawdownFromHighBps: drawdown, volumeChangeBps: volumeChange,
    liquidityChangeBps: liquidityChange, buyPressureBps: buyPressure,
    marketConfirmed: profileConfirmation,
    reason: eligible
      ? `${pattern.replaceAll("_", " ")} confirmed by executable price, volume, liquidity and buy pressure`
      : permittedPattern ? "Price pattern formed but market activity did not confirm it"
        : "No supported multi-horizon entry pattern is currently confirmed",
  });
}
