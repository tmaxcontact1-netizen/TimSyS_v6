export interface OscillationPoint {
  readonly observedAt: string;
  readonly outputAmountRaw: bigint;
  readonly liquidityUsd?: string | null;
  readonly fiveMinuteVolumeUsd?: string | null;
  readonly fiveMinuteBuys?: bigint | null;
  readonly fiveMinuteSells?: bigint | null;
}

export type OscillationSignalType = "extreme_oversold" | "midpoint_reversion";

export interface OscillationAssessment {
  readonly eligible: boolean;
  readonly reason: string;
  readonly signalType: OscillationSignalType | null;
  readonly score: number;
  readonly observationCount: number;
  readonly coverageSeconds: number;
  readonly meanAbsoluteReturnBps: number;
  readonly annualizedVolatilityScoreBps: number;
  readonly turnoverRate: number | null;
  readonly bollingerWidthBps: number;
  readonly smaCrossings: number;
  readonly lagOneAutocorrelation: number;
  readonly rsiExtremeTransitions: number;
  readonly currentRsi: number;
  readonly zScore: number;
  readonly latestReturnBps: number;
  readonly consecutiveDownSteps: number;
  readonly buyPressure: number | null;
  readonly q75ExcursionBps: number;
  readonly targetBps: number;
  readonly hardStopBps: number;
  readonly trailingStopBps: number;
  readonly maximumHoldingMinutes: number;
  readonly maximumRoundTripCostBps: number;
  readonly gates: Readonly<Record<string, boolean>>;
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const populationDeviation = (values: readonly number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

const quantile = (values: readonly number[], q: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position), high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
};

export function lagOneAutocorrelation(values: readonly number[]): number {
  if (values.length < 5) return 0;
  const left = values.slice(0, -1), right = values.slice(1);
  const leftMean = mean(left), rightMean = mean(right);
  let numerator = 0, leftSquares = 0, rightSquares = 0;
  for (let index = 0; index < left.length; index += 1) {
    const x = left[index]! - leftMean, y = right[index]! - rightMean;
    numerator += x * y; leftSquares += x * x; rightSquares += y * y;
  }
  const denominator = Math.sqrt(leftSquares * rightSquares);
  return denominator === 0 ? 0 : numerator / denominator;
}

function rsiSeries(returns: readonly number[], period = 14): readonly number[] {
  if (returns.length < period) return [];
  const values: number[] = [];
  for (let end = period; end <= returns.length; end += 1) {
    const window = returns.slice(end - period, end);
    const gain = mean(window.map((value) => Math.max(0, value)));
    const loss = mean(window.map((value) => Math.max(0, -value)));
    values.push(loss === 0 ? 100 : gain === 0 ? 0 : 100 - 100 / (1 + gain / loss));
  }
  return values;
}

function smaCrossings(prices: readonly number[], period = 20): number {
  let crossings = 0, previousSide = 0;
  for (let index = period - 1; index < prices.length; index += 1) {
    const average = mean(prices.slice(index - period + 1, index + 1));
    const side = Math.sign(prices[index]! - average);
    if (side !== 0 && previousSide !== 0 && side !== previousSide) crossings += 1;
    if (side !== 0) previousSide = side;
  }
  return crossings;
}

function extremeTransitions(values: readonly number[]): number {
  let transitions = 0, previous: "low" | "middle" | "high" = "middle";
  for (const value of values) {
    const state = value <= 30 ? "low" : value >= 70 ? "high" : "middle";
    if (state !== "middle" && state !== previous) transitions += 1;
    previous = state;
  }
  return transitions;
}

/** Pure, deterministic mean-reversion assessment over fixed-input executable quotes. */
export function evaluateOscillation(points: readonly OscillationPoint[]): OscillationAssessment {
  const ordered = [...points]
    .filter((point) => point.outputAmountRaw > 0n && Number.isFinite(Date.parse(point.observedAt)))
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const latestAt = Date.parse(ordered.at(-1)?.observedAt ?? "");
  const window = ordered.filter((point) => latestAt - Date.parse(point.observedAt) <= 30 * 60_000);
  const base = window[0]?.outputAmountRaw ?? 0n;
  const prices = base === 0n ? [] : window.map((point) => Number(base) / Number(point.outputAmountRaw));
  const returns = prices.slice(1).map((price, index) => 10_000 * (price / prices[index]! - 1));
  const coverageSeconds = window.length < 2 ? 0 :
    (Date.parse(window.at(-1)!.observedAt) - Date.parse(window[0]!.observedAt)) / 1000;
  const meanAbsoluteReturnBps = mean(returns.map(Math.abs));
  const annualizedVolatilityScoreBps = coverageSeconds <= 0 ? 0 :
    meanAbsoluteReturnBps * Math.sqrt(1800 / Math.max(1, coverageSeconds / Math.max(1, returns.length)));
  const recentPrices = prices.slice(-20);
  const priceMean = mean(recentPrices), deviation = populationDeviation(recentPrices);
  const bollingerWidthBps = priceMean === 0 ? 0 : 40_000 * deviation / priceMean;
  const autocorrelation = lagOneAutocorrelation(returns);
  const crossings = smaCrossings(prices);
  const rsi = rsiSeries(returns);
  const currentRsi = rsi.at(-1) ?? 50;
  const rsiExtremeTransitions = extremeTransitions(rsi);
  const zScore = deviation === 0 ? 0 : (prices.at(-1)! - priceMean) / deviation;
  const latestReturnBps = returns.at(-1) ?? 0;
  let consecutiveDownSteps = 0;
  for (let index = returns.length - 2; index >= 0 && returns[index]! < 0; index -= 1)
    consecutiveDownSteps += 1;
  const latest = window.at(-1);
  const transactions = (latest?.fiveMinuteBuys ?? 0n) + (latest?.fiveMinuteSells ?? 0n);
  const buyPressure = transactions === 0n || latest?.fiveMinuteBuys == null ? null :
    Number(latest.fiveMinuteBuys * 10_000n / transactions) / 10_000;
  const liquidity = Number(latest?.liquidityUsd ?? "0");
  const volume = Number(latest?.fiveMinuteVolumeUsd ?? "0");
  const turnoverRate = liquidity > 0 && Number.isFinite(volume) ? volume / liquidity : null;
  const excursions: number[] = [];
  for (let index = 0; index + 2 < prices.length; index += 2)
    excursions.push(Math.abs(10_000 * (prices[index + 2]! / prices[index]! - 1)));
  const q75ExcursionBps = quantile(excursions, .75);
  const targetBps = Math.round(Math.max(50, Math.min(150, .7 * q75ExcursionBps)));
  const hardStopBps = Math.round(Math.max(35, .6 * targetBps));
  const averageMinuteMove = coverageSeconds === 0 ? 0 :
    meanAbsoluteReturnBps * (60 * returns.length / coverageSeconds);
  const maximumHoldingMinutes = Math.max(3, Math.min(8,
    Math.ceil(targetBps / Math.max(1, averageMinuteMove))));
  const gates = Object.freeze({
    observations: window.length >= 30 && coverageSeconds >= 20 * 60,
    liquidity: liquidity >= 50_000,
    volatility: annualizedVolatilityScoreBps >= 150,
    bollingerWidth: bollingerWidthBps >= 80 && bollingerWidthBps <= 250,
    crossings: crossings >= 6,
    autocorrelation: autocorrelation < -.2,
    rsiExtremes: rsiExtremeTransitions >= 3,
    turnover: turnoverRate !== null && turnoverRate >= .005,
  });
  const score = (gates.volatility ? 25 : 0) + (gates.turnover ? 15 : 0) +
    (gates.bollingerWidth ? 15 : 0) + (gates.crossings ? 20 : 0) +
    (gates.autocorrelation ? 15 : 0) + (gates.rsiExtremes ? 10 : 0);
  const oversold = (zScore <= -1.8 || currentRsi <= 30) && latestReturnBps > 0 &&
    consecutiveDownSteps >= 3 && (buyPressure === null || buyPressure >= .48);
  const previousPrice = prices.at(-2) ?? 0;
  const previousZ = deviation === 0 ? 0 : (previousPrice - priceMean) / deviation;
  const volumeAverage = mean(window.slice(0, -1).map((point) => Number(point.fiveMinuteVolumeUsd ?? "0")));
  const midpoint = Math.abs(zScore) <= .5 && Math.abs(previousZ) >= .8 &&
    previousZ < 0 && autocorrelation < -.2 && volumeAverage > 0 && volume >= 1.3 * volumeAverage;
  const signalType = oversold ? "extreme_oversold" : midpoint ? "midpoint_reversion" : null;
  const structural = gates.observations && gates.liquidity && score >= 60;
  const eligible = structural && signalType !== null;
  const reason = !gates.observations ? "The 30-minute window lacks sufficient time coverage"
    : !gates.liquidity ? "Pool liquidity is below $50,000"
      : score < 60 ? `Oscillation score ${score} is below 60`
        : signalType === null ? "Oscillation regime is present but no long-side reversal has begun"
          : `${signalType} signal confirmed`;
  return Object.freeze({
    eligible, reason, signalType, score, observationCount: window.length, coverageSeconds,
    meanAbsoluteReturnBps, annualizedVolatilityScoreBps, turnoverRate, bollingerWidthBps,
    smaCrossings: crossings, lagOneAutocorrelation: autocorrelation,
    rsiExtremeTransitions, currentRsi, zScore, latestReturnBps, consecutiveDownSteps,
    buyPressure, q75ExcursionBps, targetBps, hardStopBps,
    trailingStopBps: Math.max(20, Math.round(targetBps / 2)), maximumHoldingMinutes,
    maximumRoundTripCostBps: Math.floor(.6 * targetBps), gates,
  });
}
