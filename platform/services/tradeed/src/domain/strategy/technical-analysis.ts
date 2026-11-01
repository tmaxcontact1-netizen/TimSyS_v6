import type { ExecutableMarketPoint } from "./short-horizon.js";

export interface ExecutableBar {
  readonly openedAt: string;
  readonly closedAt: string;
  readonly samples: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

export interface TechnicalAnalysis {
  readonly sampleCount: number;
  readonly barCount: number;
  readonly recentMaxGapSeconds: number;
  readonly coveredRecentBars: number;
  readonly rsi: number;
  readonly priorRsi: number;
  readonly emaFast: number;
  readonly emaSlow: number;
  readonly emaSpreadBps: number;
  readonly emaSlopeBps: number;
  readonly macdHistogramBps: number;
  readonly bollingerPosition: number;
  readonly atrBps: number;
  readonly efficiencyRatio: number;
  readonly accelerationBps: number;
  readonly historyReturnBps: number;
  readonly maximumDrawdownBps: number;
  readonly recoveryFromLowBps: number;
  readonly bullishClose: boolean;
  readonly higherLows: boolean;
  readonly overextended: boolean;
  readonly qualityScore: number;
  readonly bars: readonly ExecutableBar[];
}

const finite = (value: number, fallback = 0): number => Number.isFinite(value) ? value : fallback;
const round = (value: number, places = 2): number => {
  const scale = 10 ** places;
  return Math.round(finite(value) * scale) / scale;
};
const elapsedEma = (values: readonly number[], times: readonly number[], halfLifeMinutes: number): number => {
  let value = values[0] ?? 0;
  for (let index = 1; index < values.length; index += 1) {
    const minutes = (times[index]! - times[index - 1]!) / 60_000;
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    const weight = 1 - Math.exp(-Math.LN2 * minutes / halfLifeMinutes);
    value += weight * (values[index]! - value);
  }
  return value;
};
const rsi = (values: readonly number[], period = 14): number => {
  const sample = values.slice(-period - 1);
  if (sample.length < 2) return 50;
  const changes = sample.slice(1).map((value, index) => value - sample[index]!);
  const divisor = Math.max(changes.length, 1);
  const gain = changes.reduce((sum, value) => sum + Math.max(value, 0), 0) / divisor;
  const loss = changes.reduce((sum, value) => sum + Math.max(-value, 0), 0) / divisor;
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
};
const bps = (older: number, newer: number): number => older > 0 ? ((newer / older) - 1) * 10_000 : 0;

/**
 * Converts executable quote samples into honest five-minute OHLC micro-bars.
 * These are not exchange candles: they describe only prices the paper engine
 * actually observed and are labelled as such throughout the application.
 */
export function buildExecutableBars(
  points: readonly ExecutableMarketPoint[],
  bucketMinutes = 5,
): readonly ExecutableBar[] {
  if (points.length === 0) return Object.freeze([]);
  const anchor = Number(points[0]!.outputAmountRaw);
  const buckets = new Map<number, { times: string[]; prices: number[] }>();
  for (const point of points) {
    const time = Date.parse(point.observedAt);
    if (!Number.isFinite(time) || point.outputAmountRaw <= 0n) continue;
    const bucket = Math.floor(time / (bucketMinutes * 60_000));
    const entry = buckets.get(bucket) ?? { times: [], prices: [] };
    entry.times.push(point.observedAt);
    entry.prices.push(anchor / Number(point.outputAmountRaw) * 10_000);
    buckets.set(bucket, entry);
  }
  return Object.freeze([...buckets.entries()].sort(([left], [right]) => left - right).map(([, value]) => ({
    openedAt: value.times[0]!,
    closedAt: value.times.at(-1)!,
    samples: value.prices.length,
    open: round(value.prices[0]!, 6),
    high: round(Math.max(...value.prices), 6),
    low: round(Math.min(...value.prices), 6),
    close: round(value.prices.at(-1)!, 6),
  })));
}

/** Calculates deterministic indicators from executable quote history. */
export function analyseExecutableHistory(points: readonly ExecutableMarketPoint[]): TechnicalAnalysis {
  const recent = points.slice(-60);
  const anchor = Number(recent[0]?.outputAmountRaw ?? 1n);
  const prices = recent.map((point) => anchor / Number(point.outputAmountRaw) * 10_000);
  const times = recent.map((point) => Date.parse(point.observedAt));
  const latest = prices.at(-1) ?? 0;
  const fast = elapsedEma(prices, times, 2.5);
  const slow = elapsedEma(prices, times, 6);
  const priorFast = elapsedEma(prices.slice(0, -1), times.slice(0, -1), 2.5);
  const currentRsi = prices.length >= 15 ? rsi(prices) : 50;
  const previousRsi = prices.length >= 16 ? rsi(prices.slice(0, -1)) : 50;
  const macdSeries = prices.length >= 26 ? prices.slice(25).map((_, index) => {
    const sample = prices.slice(0, index + 26);
    const sampleTimes = times.slice(0, index + 26);
    return elapsedEma(sample, sampleTimes, 6) - elapsedEma(sample, sampleTimes, 13);
  }) : [];
  const macd = macdSeries.at(-1) ?? 0;
  const macdSignal = elapsedEma(macdSeries, times.slice(25), 4.5);
  const band = prices.slice(-20);
  const mean = band.reduce((sum, value) => sum + value, 0) / Math.max(band.length, 1);
  const deviation = Math.sqrt(band.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(band.length, 1));
  const changes = prices.slice(1).map((value, index) => value - prices[index]!);
  const absoluteTravel = changes.reduce((sum, value) => sum + Math.abs(value), 0);
  const netTravel = Math.abs(latest - (prices[0] ?? latest));
  let runningHigh = prices[0] ?? latest;
  let maximumDrawdownBps = 0;
  for (const price of prices) {
    runningHigh = Math.max(runningHigh, price);
    maximumDrawdownBps = Math.max(maximumDrawdownBps, Math.max(0, -bps(runningHigh, price)));
  }
  const observedLow = prices.length ? Math.min(...prices) : latest;
  const trueRanges = prices.slice(1).map((value, index) => Math.abs(bps(prices[index]!, value)));
  const bars = buildExecutableBars(recent);
  const recentTimes = recent.slice(-20).map((point) => Date.parse(point.observedAt));
  const recentMaxGapSeconds = recentTimes.slice(1).reduce((maximum, time, index) =>
    Math.max(maximum, (time - recentTimes[index]!) / 1000), 0);
  const coveredRecentBars = bars.slice(-3).filter((bar) => bar.samples >= 2).length;
  const lastBar = bars.at(-1);
  const barRange = lastBar ? lastBar.high - lastBar.low : 0;
  const bullishClose = Boolean(lastBar && lastBar.close >= lastBar.open &&
    (barRange === 0 || (lastBar.close - lastBar.low) / barRange >= .6));
  const lastThree = bars.slice(-3);
  const higherLows = lastThree.length >= 3 && lastThree.slice(1).every((bar, index) => bar.low >= lastThree[index]!.low);
  const shortReturn = prices.length >= 4 ? bps(prices.at(-4)!, latest) : 0;
  const priorShortReturn = prices.length >= 7 ? bps(prices.at(-7)!, prices.at(-4)!) : 0;
  const emaSpreadBps = bps(slow, fast);
  const atrBps = trueRanges.slice(-14).reduce((sum, value) => sum + value, 0) /
    Math.max(trueRanges.slice(-14).length, 1);
  const bollingerPosition = deviation > 0 ? (latest - mean) / (2 * deviation) : 0;
  const efficiencyRatio = absoluteTravel > 0 ? netTravel / absoluteTravel : 0;
  const overextended = currentRsi >= 78 || bollingerPosition >= 1.15 ||
    (atrBps > 0 && Math.max(0, bps(slow, latest)) > atrBps * 3);
  const qualityScore = Math.max(0, Math.min(100, Math.round(
    (fast > slow ? 18 : 0) + (fast > priorFast ? 12 : 0) +
    (currentRsi >= 48 && currentRsi <= 72 ? 16 : 0) +
    (macd > macdSignal ? 16 : 0) + (efficiencyRatio >= .3 ? 14 : 0) +
    (bullishClose ? 12 : 0) + (higherLows ? 12 : 0) - (overextended ? 30 : 0),
  )));
  return Object.freeze({
    sampleCount: prices.length,
    barCount: bars.length,
    recentMaxGapSeconds: round(recentMaxGapSeconds, 1),
    coveredRecentBars,
    rsi: round(currentRsi, 1),
    priorRsi: round(previousRsi, 1),
    emaFast: round(fast, 4),
    emaSlow: round(slow, 4),
    emaSpreadBps: round(emaSpreadBps, 1),
    emaSlopeBps: round(bps(priorFast, fast), 1),
    macdHistogramBps: slow > 0 ? round((macd - macdSignal) / slow * 10_000, 1) : 0,
    bollingerPosition: round(bollingerPosition, 2),
    atrBps: round(atrBps, 1),
    efficiencyRatio: round(efficiencyRatio, 3),
    accelerationBps: round(shortReturn - priorShortReturn, 1),
    historyReturnBps: round(bps(prices[0] ?? latest, latest), 1),
    maximumDrawdownBps: round(maximumDrawdownBps, 1),
    recoveryFromLowBps: round(bps(observedLow, latest), 1),
    bullishClose,
    higherLows,
    overextended,
    qualityScore,
    bars,
  });
}
