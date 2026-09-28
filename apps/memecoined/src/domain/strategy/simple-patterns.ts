import type { ExecutableMarketPoint } from "./short-horizon.js";

export interface SimplePatternDecision {
  readonly eligible: boolean;
  readonly rule: string;
  readonly entryPrice: number;
  readonly referencePrice: number;
  readonly rsi: number;
  readonly zScore: number;
  readonly buyPressure: number | null;
  readonly liquidityUsd: number;
  readonly smaCrossings: number;
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const deviation = (values: readonly number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

const rsi = (prices: readonly number[], period = 14) => {
  const changes = prices.slice(-period - 1).slice(1)
    .map((price, index) => price - prices.slice(-period - 1)[index]!);
  if (changes.length < period) return 50;
  const gain = mean(changes.map((value) => Math.max(0, value)));
  const loss = mean(changes.map((value) => Math.max(0, -value)));
  return loss === 0 ? 100 : gain === 0 ? 0 : 100 - 100 / (1 + gain / loss);
};

function normalize(points: readonly ExecutableMarketPoint[], minutes: number) {
  const ordered = [...points]
    .filter((point) => point.outputAmountRaw > 0n && Number.isFinite(Date.parse(point.observedAt)))
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const latestAt = Date.parse(ordered.at(-1)?.observedAt ?? "");
  const window = ordered.filter((point) => latestAt - Date.parse(point.observedAt) <= minutes * 60_000);
  const base = window[0]?.outputAmountRaw ?? 0n;
  const prices = base === 0n ? [] : window.map((point) => Number(base) / Number(point.outputAmountRaw));
  const latest = window.at(-1);
  const transactions = (latest?.fiveMinuteBuys ?? 0n) + (latest?.fiveMinuteSells ?? 0n);
  return {
    window,
    prices,
    latestPrice: prices.at(-1) ?? 0,
    liquidityUsd: Number(latest?.liquidityUsd ?? "0"),
    buyPressure: transactions === 0n || latest?.fiveMinuteBuys == null ? null
      : Number(latest.fiveMinuteBuys * 10_000n / transactions) / 10_000,
  };
}

function crossingsAgainstSma(prices: readonly number[], period = 20) {
  let crossings = 0;
  let previousSide = 0;
  for (let index = period - 1; index < prices.length; index += 1) {
    const average = mean(prices.slice(index - period + 1, index + 1));
    const side = Math.sign(prices[index]! - average);
    if (side !== 0 && previousSide !== 0 && side !== previousSide) crossings += 1;
    if (side !== 0) previousSide = side;
  }
  // Sparse executable quotes can move through a rolling SMA between samples.
  // Preserve those observable crossings by counting reversals in successive
  // price changes as the conservative discrete-time equivalent.
  let directionalCrossings = 0;
  let previousDirection = 0;
  for (let index = 1; index < prices.length; index += 1) {
    const direction = Math.sign(prices[index]! - prices[index - 1]!);
    if (direction !== 0 && previousDirection !== 0 && direction !== previousDirection)
      directionalCrossings += 1;
    if (direction !== 0) previousDirection = direction;
  }
  return Math.max(crossings, directionalCrossings);
}

export function simpleOscillationAdmissionFromMetrics(input: Readonly<{
  observationCount: number;
  smaCrossings: number;
  rsi: number;
  zScore: number;
  liquidityUsd: number;
}>): Readonly<{ eligible: boolean; rule: string }> {
  const eligible = input.observationCount >= 20 && input.smaCrossings >= 3 &&
    (input.rsi <= 30 || input.zScore <= -2) && input.liquidityUsd >= 25_000;
  return Object.freeze({
    eligible,
    rule: input.observationCount < 20 ? "fewer_than_20_price_observations"
      : input.smaCrossings < 3 ? "fewer_than_3_sma_crossings"
        : input.rsi > 30 && input.zScore > -2 ? "price_not_oversold"
          : input.liquidityUsd < 25_000 ? "liquidity_below_25000_usd"
            : "oscillating_and_oversold",
  });
}

export function evaluateSimpleFastFurious(points: readonly ExecutableMarketPoint[]): SimplePatternDecision {
  const state = normalize(points, 15);
  const recentHigh = state.prices.length === 0 ? 0 : Math.max(...state.prices);
  const pullbackBps = recentHigh <= 0 ? 0 : 10_000 * (recentHigh - state.latestPrice) / recentHigh;
  const enoughHistory = state.prices.length >= 2;
  const eligible = enoughHistory && pullbackBps >= 20 && pullbackBps <= 100 &&
    (state.buyPressure ?? 0) >= .45 && state.liquidityUsd >= 25_000;
  return Object.freeze({
    eligible,
    rule: !enoughHistory ? "insufficient_price_history"
      : pullbackBps < 20 ? "price_not_20_bps_below_recent_high"
        : pullbackBps > 100 ? "pullback_exceeds_100_bps"
          : (state.buyPressure ?? 0) < .45 ? "buy_pressure_below_45_percent"
            : state.liquidityUsd < 25_000 ? "liquidity_below_25000_usd"
              : "short_pullback_20_to_100_bps",
    entryPrice: state.latestPrice,
    referencePrice: recentHigh,
    rsi: rsi(state.prices),
    zScore: 0,
    buyPressure: state.buyPressure,
    liquidityUsd: state.liquidityUsd,
    smaCrossings: 0,
  });
}

export function evaluateSimpleOscillation(points: readonly ExecutableMarketPoint[]): SimplePatternDecision {
  const state = normalize(points, 30);
  const recent = state.prices.slice(-20);
  const average = mean(recent);
  const sigma = deviation(recent);
  const currentRsi = rsi(state.prices);
  const zScore = sigma === 0 ? 0 : (state.latestPrice - average) / sigma;
  const smaCrossings = crossingsAgainstSma(state.prices, 20);
  const admission = simpleOscillationAdmissionFromMetrics({
    observationCount: state.prices.length,
    smaCrossings,
    rsi: currentRsi,
    zScore,
    liquidityUsd: state.liquidityUsd,
  });
  return Object.freeze({
    eligible: admission.eligible,
    rule: admission.rule,
    entryPrice: state.latestPrice,
    referencePrice: average,
    rsi: currentRsi,
    zScore,
    buyPressure: state.buyPressure,
    liquidityUsd: state.liquidityUsd,
    smaCrossings,
  });
}
