import type { TradingProfileId } from "./profiles.js";
import { analyseExecutableHistory, type TechnicalAnalysis } from "./technical-analysis.js";

export interface ExecutableMarketPoint {
  readonly observedAt: string;
  readonly outputAmountRaw: bigint;
  readonly liquidityUsd?: string | null;
  readonly fiveMinuteVolumeUsd?: string | null;
  readonly fiveMinuteBuys?: bigint | null;
  readonly fiveMinuteSells?: bigint | null;
  readonly poolAgeMinutes?: number | null;
}

export interface ShortHorizonSignal {
  readonly eligible: boolean;
  readonly pattern: "insufficient_history" | "momentum" | "pullback_rebound" | "range_rebound" | "trend" | "liquidity_expansion" | "buy_hold" | "ema_cross" | "rsi_reversal" | "macd_trend" | "bollinger_reversion" | "donchian_breakout" | "volume_breakout" | "atr_trend" | "none";
  readonly latestMoveBps: number;
  readonly shortMoveBps: number;
  readonly cumulativeMoveBps: number;
  readonly observedVolatilityBps: number;
  readonly positiveSteps: number;
  readonly drawdownFromHighBps: number;
  readonly volumeChangeBps: number | null;
  readonly liquidityChangeBps: number | null;
  readonly buyPressureBps: number | null;
  readonly liquidityPositiveSteps: number;
  readonly volumePositiveSteps: number;
  readonly marketConfirmed: boolean;
  readonly indicator?: string;
  readonly indicatorValue?: number;
  readonly technical: TechnicalAnalysis;
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
  buyPressureBps: null, liquidityPositiveSteps: 0, volumePositiveSteps: 0, marketConfirmed: false,
  technical: analyseExecutableHistory([]),
  reason: "Six executable observations are required for multi-horizon analysis",
});

const ema = (values: readonly number[], period: number): number => {
  const multiplier = 2 / (period + 1);
  return values.slice(1).reduce((value, next) => next * multiplier + value * (1 - multiplier), values[0] ?? 0);
};
const rsi = (values: readonly number[], period = 14): number => {
  const changes = values.slice(-period - 1).slice(1).map((value, index) => value - values.slice(-period - 1)[index]!);
  const gain = changes.reduce((sum, value) => sum + Math.max(value, 0), 0) / period;
  const loss = changes.reduce((sum, value) => sum + Math.max(-value, 0), 0) / period;
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
};

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
  const liquidityPositiveSteps = recent.slice(1).filter((point, index) =>
    Number(point.liquidityUsd) > Number(recent[index]!.liquidityUsd)).length;
  const volumePositiveSteps = recent.slice(1).filter((point, index) =>
    Number(point.fiveMinuteVolumeUsd) >= Number(recent[index]!.fiveMinuteVolumeUsd)).length;
  const technical = analyseExecutableHistory(points);
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
  const all = points.slice(-40);
  const anchor = Number(all[0]?.outputAmountRaw ?? 1n);
  const prices = all.map((point) => anchor / Number(point.outputAmountRaw) * 10_000);
  const latestPrice = prices.at(-1) ?? 0;
  const priorPrice = prices.at(-2) ?? latestPrice;
  const emaFast = ema(prices.slice(-12), 5);
  const emaSlow = ema(prices.slice(-20), 12);
  const currentRsi = prices.length >= 15 ? rsi(prices) : 50;
  const priorRsi = prices.length >= 16 ? rsi(prices.slice(0, -1)) : 50;
  const macd = ema(prices.slice(-26), 12) - ema(prices.slice(-26), 26);
  const macdSeries = prices.length >= 35
    ? prices.slice(25).map((_, index) => {
        const sample = prices.slice(0, index + 26);
        return ema(sample.slice(-26), 12) - ema(sample.slice(-26), 26);
      }) : [];
  const macdSignal = ema(macdSeries.slice(-9), 9);
  const bandSample = prices.slice(-20);
  const mean = bandSample.reduce((sum, value) => sum + value, 0) / Math.max(bandSample.length, 1);
  const deviation = Math.sqrt(bandSample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(bandSample.length, 1));
  const priorTwentyHigh = Math.max(...prices.slice(-21, -1));
  const absoluteMoves = prices.slice(1).map((value, index) => Math.abs(value - prices[index]!));
  const atr = absoluteMoves.slice(-14).reduce((sum, value) => sum + value, 0) / Math.max(absoluteMoves.slice(-14).length, 1);
  const latestVolume = Number(all.at(-1)?.fiveMinuteVolumeUsd ?? 0);
  const priorVolumes = all.slice(-7, -1).map((point) => Number(point.fiveMinuteVolumeUsd ?? 0)).filter(Number.isFinite);
  const averageVolume = priorVolumes.reduce((sum, value) => sum + value, 0) / Math.max(priorVolumes.length, 1);
  let benchmarkPattern: ShortHorizonSignal["pattern"] = "none";
  let benchmarkEligible = false;
  let indicator: string | undefined;
  let indicatorValue: number | undefined;
  if (profileId === "benchmark_buy_hold") {
    benchmarkPattern = "buy_hold"; benchmarkEligible = points.length >= 6; indicator = "observations"; indicatorValue = points.length;
  } else if (profileId === "benchmark_momentum") {
    benchmarkPattern = "momentum"; benchmarkEligible = cumulative >= 35 && positiveSteps >= 3; indicator = "cumulative move (bps)"; indicatorValue = cumulative;
  } else if (profileId === "benchmark_ema_cross") {
    benchmarkPattern = "ema_cross"; benchmarkEligible = prices.length >= 20 && emaFast > emaSlow && latestPrice > priorPrice; indicator = "fast minus slow EMA"; indicatorValue = Math.round((emaFast - emaSlow) * 100) / 100;
  } else if (profileId === "benchmark_rsi_reversal") {
    benchmarkPattern = "rsi_reversal"; benchmarkEligible = prices.length >= 16 && priorRsi <= 35 && currentRsi > priorRsi && currentRsi < 55; indicator = "RSI"; indicatorValue = Math.round(currentRsi * 10) / 10;
  } else if (profileId === "benchmark_macd_trend") {
    benchmarkPattern = "macd_trend"; benchmarkEligible = prices.length >= 35 && macd > 0 && macd > macdSignal; indicator = "MACD minus signal"; indicatorValue = Math.round((macd - macdSignal) * 100) / 100;
  } else if (profileId === "benchmark_bollinger_reversion") {
    benchmarkPattern = "bollinger_reversion"; benchmarkEligible = prices.length >= 20 && priorPrice <= mean - 2 * deviation && latestPrice > priorPrice; indicator = "standard deviations from mean"; indicatorValue = deviation ? Math.round(((latestPrice - mean) / deviation) * 100) / 100 : 0;
  } else if (profileId === "benchmark_donchian_breakout") {
    benchmarkPattern = "donchian_breakout"; benchmarkEligible = prices.length >= 21 && latestPrice > priorTwentyHigh && (volumeChange ?? 0) > 0; indicator = "break above range (bps)"; indicatorValue = Math.round((latestPrice / priorTwentyHigh - 1) * 10_000);
  } else if (profileId === "benchmark_volume_breakout") {
    benchmarkPattern = "volume_breakout"; benchmarkEligible = prices.length >= 7 && averageVolume > 0 && latestVolume >= averageVolume * 1.5 && latest > 0; indicator = "volume multiple"; indicatorValue = Math.round(latestVolume / averageVolume * 100) / 100;
  } else if (profileId === "benchmark_atr_trend") {
    benchmarkPattern = "atr_trend"; benchmarkEligible = prices.length >= 20 && latestPrice > emaSlow && latestPrice - priorPrice >= atr * 0.5; indicator = "move divided by ATR"; indicatorValue = atr ? Math.round((latestPrice - priorPrice) / atr * 100) / 100 : 0;
  }
  const launchTransition = profileId === "launch_transition" &&
    Number.isFinite(recent.at(-1)?.poolAgeMinutes) &&
    (recent.at(-1)?.poolAgeMinutes ?? Infinity) >= 30 &&
    (recent.at(-1)?.poolAgeMinutes ?? Infinity) <= 10_080 &&
    (liquidityChange ?? -Infinity) >= 100 &&
    (volumeChange ?? -Infinity) >= 0 && latest >= 0;
  const persistentTrend = trend && technical.sampleCount >= 20 && technical.emaFast > technical.emaSlow &&
    technical.emaSlopeBps > 0 && technical.macdHistogramBps >= 0 && technical.rsi >= 48 &&
    technical.rsi <= 72 && technical.efficiencyRatio >= .22 && !technical.overextended;
  const existingProfilePattern = profileId === "whale_tracker" || profileId === "slow_steady" || profileId === "capital_preservation" || profileId === "signal_consensus"
    ? persistentTrend : profileId === "trend_detector"
      ? persistentTrend && technical.qualityScore >= 60 && technical.accelerationBps >= -25
      : profileId === "liquidity_expansion"
      ? (liquidityChange ?? -Infinity) >= 100 && (volumeChange ?? -Infinity) >= 0 && latest >= 0 &&
        technical.sampleCount >= 16 && technical.emaFast > technical.emaSlow && technical.rsi <= 74 &&
        technical.qualityScore >= 48 && !technical.overextended
      : profileId === "launch_transition" ? launchTransition
      : permittedPattern;
  if ((profileId === "liquidity_expansion" || profileId === "launch_transition") && existingProfilePattern)
    benchmarkPattern = "liquidity_expansion";
  const isBenchmark = profileId.startsWith("benchmark_");
  const selectedPattern = isBenchmark ? benchmarkPattern : benchmarkPattern !== "none" ? benchmarkPattern : pattern;
  const eligible = (isBenchmark ? benchmarkEligible : existingProfilePattern) && profileConfirmation;
  return Object.freeze({
    eligible, pattern: selectedPattern, latestMoveBps: latest, shortMoveBps: short,
    cumulativeMoveBps: cumulative, observedVolatilityBps: volatility, positiveSteps,
    drawdownFromHighBps: drawdown, volumeChangeBps: volumeChange,
    liquidityChangeBps: liquidityChange, buyPressureBps: buyPressure,
    liquidityPositiveSteps, volumePositiveSteps,
    marketConfirmed: profileConfirmation,
    technical,
    ...(indicator === undefined ? {} : { indicator }),
    ...(indicatorValue === undefined ? {} : { indicatorValue }),
    reason: eligible
      ? `${selectedPattern.replaceAll("_", " ")} confirmed by executable price, volume, liquidity and buy pressure`
      : (isBenchmark ? benchmarkEligible : existingProfilePattern) ? "Price pattern formed but market activity did not confirm it"
        : "No supported multi-horizon entry pattern is currently confirmed",
  });
}
