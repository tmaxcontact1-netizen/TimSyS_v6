export const profileIds = [
  "whale_tracker",
  "fast_furious",
  "slow_steady",
  "trend_detector",
  "capital_preservation",
  "signal_consensus",
  "breakout_retest",
  "liquidity_expansion",
  "social_catalyst",
  "recovery_reversal",
  "launch_transition",
  "scalper",
  "oscillation_trader",
  "benchmark_buy_hold",
  "benchmark_momentum",
  "benchmark_ema_cross",
  "benchmark_rsi_reversal",
  "benchmark_macd_trend",
  "benchmark_bollinger_reversion",
  "benchmark_donchian_breakout",
  "benchmark_volume_breakout",
  "benchmark_atr_trend",
] as const;

export type TradingProfileId = (typeof profileIds)[number];
export type PaperProfileMode = "observe" | "recommend" | "automatic_paper";

/** The deliberately small, supported MemeCoined product surface. Legacy profile
 * definitions remain below solely so historical records can still be decoded. */
export const focusedProfileIds = ["fast_furious", "oscillation_trader"] as const;
export type FocusedProfileId = (typeof focusedProfileIds)[number];
export const focusedProfileIdSet: ReadonlySet<TradingProfileId> = new Set(focusedProfileIds);

export interface TradingProfileDefinition {
  readonly id: TradingProfileId;
  readonly name: string;
  readonly summary: string;
  readonly approach: string;
  readonly defaultAllocationBps: number;
  readonly maximumConcurrentPositions: number;
  readonly riskPerTradeBps: number;
  readonly minimumCandidateScore: number;
  readonly requiresWhaleConfirmation: boolean;
  readonly maximumHoldingMinutes: number;
  readonly hardStopBps: number;
  readonly firstProfitTargetBps: number;
  readonly trailingStopBps: number;
  readonly evidenceStatus?: "ready" | "awaiting_data";
  readonly evidenceMessage?: string;
  readonly group?: "timsys" | "benchmark";
  readonly decisionModel?: string;
}

export const tradingProfileCatalogue: readonly TradingProfileDefinition[] = Object.freeze([
  {
    id: "fast_furious",
    name: "Fast & Furious",
    summary: "Adapts each short trade to the token's repeatable executable price range.",
    approach:
      "Learns per-token targets, loss limits, trailing protection and time limits without relaxing security gates.",
    decisionModel:
      "Five-minute executable-price bars + EMA slope + RSI + acceleration + per-token volatility + market confirmation",
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 3,
    riskPerTradeBps: 40,
    minimumCandidateScore: 45,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 15,
    hardStopBps: 200,
    firstProfitTargetBps: 200,
    trailingStopBps: 75,
  },
  {
    id: "slow_steady",
    name: "Slow & Steady",
    summary: "Uses stronger evidence and liquidity requirements for longer, calmer positions.",
    approach: "Prefers established momentum and lower concentration over early entry speed.",
    decisionModel:
      "Established EMA trend + MACD + RSI + trend efficiency + strong liquidity and transaction quality",
    defaultAllocationBps: 2000,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 25,
    minimumCandidateScore: 55,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 4320,
    hardStopBps: 1200,
    firstProfitTargetBps: 3000,
    trailingStopBps: 1200,
  },
  {
    id: "trend_detector",
    name: "New Coin Detector",
    summary: "Finds emerging coins and stays with a healthy rise while protecting gains.",
    approach:
      "Uses acceleration, breadth, liquidity and staged trailing exits instead of guessing a peak.",
    decisionModel:
      "EMA and MACD trend + positive acceleration + RSI + trend efficiency + stable liquidity",
    defaultAllocationBps: 2000,
    maximumConcurrentPositions: 3,
    riskPerTradeBps: 35,
    minimumCandidateScore: 45,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 360,
    hardStopBps: 700,
    firstProfitTargetBps: 1000,
    trailingStopBps: 400,
  },
  {
    id: "capital_preservation",
    name: "Capital Preservation",
    summary: "Participates selectively with the smallest risk and strongest evidence requirements.",
    approach: "Designed as the defensive benchmark against which the faster profiles are compared.",
    decisionModel:
      "Low-volatility trend + strongest liquidity, holder and transaction-quality thresholds",
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 1,
    riskPerTradeBps: 15,
    minimumCandidateScore: 60,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 1440,
    hardStopBps: 800,
    firstProfitTargetBps: 1800,
    trailingStopBps: 700,
  },
  {
    id: "signal_consensus",
    name: "Signal Consensus",
    summary: "Acts only when independent market, quote and token evidence agree.",
    approach:
      "Trades less often and rejects candidates supported by only one source or signal type.",
    decisionModel:
      "Liquidity, momentum, holders and transaction quality + independent quote and safety agreement",
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 25,
    minimumCandidateScore: 60,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 1440,
    hardStopBps: 1000,
    firstProfitTargetBps: 2200,
    trailingStopBps: 900,
    evidenceStatus: "ready",
    evidenceMessage:
      "Uses the independent market, executable-quote, holder and dual-RPC safety evidence currently collected.",
  },
  {
    id: "breakout_retest",
    name: "Breakout & Retest",
    summary: "Waits for a price breakout, a controlled pullback and renewed buying support.",
    approach:
      "Avoids chasing the first spike and enters only after the former resistance area holds.",
    decisionModel: "Recorded pullback + renewed executable-price rise + confirmed market activity",
    defaultAllocationBps: 750,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 20,
    minimumCandidateScore: 68,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 180,
    hardStopBps: 500,
    firstProfitTargetBps: 700,
    trailingStopBps: 300,
    evidenceStatus: "ready",
    evidenceMessage:
      "Uses rolling executable-quote history to confirm the pullback and renewed demand.",
  },
  {
    id: "liquidity_expansion",
    name: "Liquidity Expansion",
    summary: "Looks for growing liquidity accompanied by credible trading activity.",
    approach: "Requires liquidity, transaction quality and holder breadth to improve together.",
    decisionModel: "Rising liquidity and volume + EMA alignment + RSI + measured technical quality",
    defaultAllocationBps: 750,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 20,
    minimumCandidateScore: 60,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 360,
    hardStopBps: 900,
    firstProfitTargetBps: 1800,
    trailingStopBps: 700,
    evidenceStatus: "ready",
    evidenceMessage:
      "Can operate from the verified market, liquidity and holder evidence already collected.",
  },
  {
    id: "recovery_reversal",
    name: "Recovery & Reversal",
    summary: "Looks for a genuine recovery after a sell-off rather than buying a continuing fall.",
    approach: "Requires a recorded decline, stabilisation and renewed demand before entry.",
    decisionModel:
      "Measured decline + stabilisation + executable-price rebound + buyer confirmation",
    defaultAllocationBps: 500,
    maximumConcurrentPositions: 1,
    riskPerTradeBps: 15,
    minimumCandidateScore: 70,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 180,
    hardStopBps: 500,
    firstProfitTargetBps: 700,
    trailingStopBps: 300,
    evidenceStatus: "ready",
    evidenceMessage:
      "Uses rolling executable-quote history to distinguish a rebound from a continuing decline.",
  },
  {
    id: "launch_transition",
    name: "Launch Transition",
    summary: "Tracks young pools developing sustained, executable market liquidity.",
    approach:
      "Requires a young verified pool, expanding liquidity and confirmed executable market activity.",
    decisionModel:
      "Verified pool age + liquidity expansion + buyer and executable-price confirmation",
    defaultAllocationBps: 500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 20,
    minimumCandidateScore: 50,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 360,
    hardStopBps: 1000,
    firstProfitTargetBps: 2500,
    trailingStopBps: 900,
    evidenceStatus: "ready",
    evidenceMessage:
      "Uses verified pool creation time, liquidity growth, market activity and executable quotes; it does not infer an unobserved launch-platform graduation event.",
  },
  {
    id: "scalper",
    name: "Bounded Scalper",
    summary:
      "Takes small, short-lived paper positions when immediate momentum and liquidity agree.",
    approach: "Uses strict position, time and loss limits; it cannot bypass token-security checks.",
    decisionModel:
      "Range rebound or immediate momentum + tight quote-cost, time, stop and trailing limits",
    defaultAllocationBps: 500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 15,
    minimumCandidateScore: 55,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 10,
    hardStopBps: 200,
    firstProfitTargetBps: 250,
    trailingStopBps: 120,
    evidenceStatus: "ready",
    evidenceMessage:
      "Can operate from current quotes, liquidity, momentum and transaction-quality evidence.",
  },
  {
    id: "oscillation_trader",
    name: "Oscillation Trader",
    summary: "Trades short, repeatable reversals inside demonstrably oscillating price ranges.",
    approach:
      "Tracks persistent executable-price oscillation using return sign changes, then waits for an oversold or midpoint rebound before entering.",
    decisionModel:
      "Persistent 30-minute oscillation regime + 20-sample entry window + rebound transition + round-trip friction",
    defaultAllocationBps: 1250,
    maximumConcurrentPositions: 10,
    riskPerTradeBps: 8,
    minimumCandidateScore: 0,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 8,
    hardStopBps: 90,
    firstProfitTargetBps: 100,
    trailingStopBps: 50,
    evidenceStatus: "ready",
    evidenceMessage:
      "Uses executable Jupiter quotes and current pool activity; every signal and outcome is retained for validation.",
  },
  ...(
    [
      [
        "benchmark_buy_hold",
        "Benchmark · Buy and Hold",
        "Buys the first safe, liquid candidate and holds it for a fixed period.",
        "Control: tests whether active timing adds value over simple exposure.",
        35,
        1440,
        1200,
        1800,
        800,
        "First confirmed executable observation",
      ],
      [
        "benchmark_momentum",
        "Benchmark · Simple Momentum",
        "Buys sustained positive movement confirmed by market activity.",
        "Published-style baseline: relative momentum without discretionary interpretation.",
        40,
        240,
        600,
        900,
        400,
        "Positive multi-sample return and majority rising samples",
      ],
      [
        "benchmark_ema_cross",
        "Benchmark · EMA Crossover",
        "Buys when a fast exponential average rises above a slower average.",
        "Classic trend-following baseline calculated from executable prices.",
        40,
        360,
        700,
        1100,
        500,
        "Fast EMA above slow EMA with positive slope",
      ],
      [
        "benchmark_rsi_reversal",
        "Benchmark · RSI Reversal",
        "Buys a measured recovery from an oversold condition.",
        "Classic mean-reversion baseline; never buys merely because price is falling.",
        40,
        180,
        500,
        700,
        300,
        "RSI recovery after an oversold reading",
      ],
      [
        "benchmark_macd_trend",
        "Benchmark · MACD Trend",
        "Buys when short and long exponential trends turn positively aligned.",
        "Classic MACD-style trend confirmation using executable price history.",
        42,
        480,
        800,
        1400,
        600,
        "Positive MACD line above its signal line",
      ],
      [
        "benchmark_bollinger_reversion",
        "Benchmark · Bollinger Reversion",
        "Buys a recovery from the lower statistical price band.",
        "Classic volatility-band mean-reversion baseline.",
        40,
        180,
        500,
        750,
        300,
        "Recovery from below the lower 20-sample band",
      ],
      [
        "benchmark_donchian_breakout",
        "Benchmark · Donchian Breakout",
        "Buys a confirmed break above the recent executable-price range.",
        "Classic channel-breakout baseline with volume confirmation.",
        42,
        360,
        700,
        1200,
        500,
        "New 20-sample high with confirmed activity",
      ],
      [
        "benchmark_volume_breakout",
        "Benchmark · Volume Breakout",
        "Buys price strength accompanied by an unusual increase in volume.",
        "Activity-led baseline that rejects volume without positive price response.",
        40,
        180,
        600,
        900,
        400,
        "Volume expansion plus positive executable-price movement",
      ],
      [
        "benchmark_atr_trend",
        "Benchmark · ATR Trend",
        "Buys a trend whose movement is meaningful relative to recent volatility.",
        "Volatility-adjusted trend baseline comparable across differently active tokens.",
        42,
        360,
        700,
        1200,
        500,
        "Positive trend exceeding a fraction of recent true range",
      ],
    ] as const
  ).map(
    ([
      id,
      name,
      summary,
      approach,
      minimumCandidateScore,
      maximumHoldingMinutes,
      hardStopBps,
      firstProfitTargetBps,
      trailingStopBps,
      decisionModel,
    ]) => ({
      id,
      name,
      summary,
      approach,
      group: "benchmark" as const,
      decisionModel,
      defaultAllocationBps: 10_000,
      maximumConcurrentPositions: 2,
      riskPerTradeBps: 25,
      minimumCandidateScore,
      requiresWhaleConfirmation: false,
      maximumHoldingMinutes,
      hardStopBps,
      firstProfitTargetBps,
      trailingStopBps,
      evidenceStatus: "ready" as const,
      evidenceMessage:
        "Runs in an isolated comparison account using the same candidates, quotes, costs and safety gates as TimSyS profiles.",
    }),
  ),
]);

export function tradingProfile(id: string): TradingProfileDefinition | null {
  return tradingProfileCatalogue.find((profile) => profile.id === id) ?? null;
}

export interface ActiveProfileAllocation {
  readonly profileId: TradingProfileId;
  readonly enabled: boolean;
  readonly allocationBps: number;
  readonly mode: PaperProfileMode;
}

/** Enforces the shared-wallet boundary used when profiles operate concurrently. */
export function validateConcurrentProfileAllocation(
  allocations: readonly ActiveProfileAllocation[],
): Readonly<{ allocatedBps: number; unallocatedBps: number }> {
  const seen = new Set<string>();
  let allocatedBps = 0;
  for (const allocation of allocations) {
    if (seen.has(allocation.profileId)) throw new Error("A trading profile may be configured once");
    seen.add(allocation.profileId);
    if (allocation.enabled && !tradingProfile(allocation.profileId))
      throw new RangeError("This trading profile is no longer available");
    if (
      !Number.isSafeInteger(allocation.allocationBps) ||
      allocation.allocationBps < 0 ||
      allocation.allocationBps > 10_000
    )
      throw new RangeError("Profile allocation must be between 0% and 100%");
    if (
      allocation.enabled &&
      allocation.mode === "automatic_paper" &&
      allocation.allocationBps === 0
    )
      throw new RangeError("Automatic paper trading requires a positive allocation");
    if (allocation.enabled && tradingProfile(allocation.profileId)?.group !== "benchmark")
      allocatedBps += allocation.allocationBps;
  }
  if (allocatedBps > 10_000)
    throw new RangeError("Enabled profile allocations exceed the paper portfolio");
  return Object.freeze({ allocatedBps, unallocatedBps: 10_000 - allocatedBps });
}
