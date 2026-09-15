import type { TradingProfileId } from "./profiles.js";

export interface ExecutableMarketPoint {
  readonly observedAt: string;
  /** Token base units received for the same SOL input on every observation. */
  readonly outputAmountRaw: bigint;
}

export interface ShortHorizonSignal {
  readonly eligible: boolean;
  readonly pattern: "insufficient_history" | "momentum" | "pullback_rebound" | "range_rebound" | "none";
  readonly latestMoveBps: number;
  readonly precedingMoveBps: number;
  readonly cumulativeMoveBps: number;
  readonly observedVolatilityBps: number;
  readonly reason: string;
}

const priceMoveBps = (olderOutput: bigint, newerOutput: bigint): number => {
  if (olderOutput <= 0n || newerOutput <= 0n) return 0;
  // A fixed SOL input buys fewer token units when the token becomes dearer.
  return Number((olderOutput * 10_000n) / newerOutput - 10_000n);
};

/** Deterministic short-horizon evidence. It identifies a pattern; it never overrides safety gates. */
export function evaluateShortHorizonSignal(
  profileId: TradingProfileId,
  points: readonly ExecutableMarketPoint[],
): ShortHorizonSignal {
  if (points.length < 3)
    return Object.freeze({
      eligible: false,
      pattern: "insufficient_history",
      latestMoveBps: 0,
      precedingMoveBps: 0,
      cumulativeMoveBps: 0,
      observedVolatilityBps: 0,
      reason: "At least three executable observations are required",
    });
  const recent = points.slice(-3);
  const preceding = priceMoveBps(recent[0]!.outputAmountRaw, recent[1]!.outputAmountRaw);
  const latest = priceMoveBps(recent[1]!.outputAmountRaw, recent[2]!.outputAmountRaw);
  const cumulative = priceMoveBps(recent[0]!.outputAmountRaw, recent[2]!.outputAmountRaw);
  const volatility = Math.max(Math.abs(preceding), Math.abs(latest), Math.abs(cumulative));
  const momentum = latest >= 25 && latest <= 600 && cumulative >= 50 && preceding > -250;
  const pullbackRebound = preceding <= -35 && preceding >= -500 && latest >= 35 && cumulative > -150;
  const rangeRebound = volatility >= 50 && volatility <= 500 && preceding < 0 && latest >= 20;
  const pattern = momentum
    ? "momentum"
    : pullbackRebound
      ? "pullback_rebound"
      : rangeRebound
        ? "range_rebound"
        : "none";
  const permitted =
    profileId === "fast_furious"
      ? momentum || pullbackRebound
      : profileId === "scalper"
        ? rangeRebound || pullbackRebound || (momentum && latest <= 250)
        : profileId === "trend_detector"
          ? momentum && preceding > 0
          : profileId === "breakout_retest" || profileId === "recovery_reversal"
            ? pullbackRebound
            : false;
  return Object.freeze({
    eligible: permitted,
    pattern,
    latestMoveBps: latest,
    precedingMoveBps: preceding,
    cumulativeMoveBps: cumulative,
    observedVolatilityBps: volatility,
    reason: permitted
      ? `${pattern.replaceAll("_", " ")} confirmed by executable quotes`
      : "No supported short-horizon entry pattern is currently confirmed",
  });
}
