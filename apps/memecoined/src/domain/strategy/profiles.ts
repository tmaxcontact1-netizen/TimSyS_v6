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
] as const;

export type TradingProfileId = (typeof profileIds)[number];
export type PaperProfileMode = "observe" | "recommend" | "automatic_paper";

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
}

export const tradingProfileCatalogue: readonly TradingProfileDefinition[] = Object.freeze([
  {
    id: "whale_tracker",
    name: "Whale Watch",
    summary: "Follows independently verified, consistently profitable wallets.",
    approach: "Only acts when trusted-wallet activity survives manipulation and security checks.",
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 35,
    minimumCandidateScore: 75,
    requiresWhaleConfirmation: true,
    maximumHoldingMinutes: 1440,
    hardStopBps: 1500,
    firstProfitTargetBps: 2500,
    trailingStopBps: 1500,
  },
  {
    id: "fast_furious",
    name: "Fast & Furious",
    summary: "Targets short, high-momentum moves and exits quickly when momentum fades.",
    approach: "Tighter time limits and trailing protection; never relaxes token-security gates.",
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 3,
    riskPerTradeBps: 40,
    minimumCandidateScore: 45,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 60,
    hardStopBps: 400,
    firstProfitTargetBps: 500,
    trailingStopBps: 250,
  },
  {
    id: "slow_steady",
    name: "Slow & Steady",
    summary: "Uses stronger evidence and liquidity requirements for longer, calmer positions.",
    approach: "Prefers established momentum and lower concentration over early entry speed.",
    defaultAllocationBps: 2000,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 25,
    minimumCandidateScore: 83,
    requiresWhaleConfirmation: true,
    maximumHoldingMinutes: 4320,
    hardStopBps: 1200,
    firstProfitTargetBps: 3000,
    trailingStopBps: 1200,
  },
  {
    id: "trend_detector",
    name: "New Coin Detector",
    summary: "Finds emerging coins and stays with a healthy rise while protecting gains.",
    approach: "Uses acceleration, breadth, liquidity and staged trailing exits instead of guessing a peak.",
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
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 1,
    riskPerTradeBps: 15,
    minimumCandidateScore: 88,
    requiresWhaleConfirmation: true,
    maximumHoldingMinutes: 1440,
    hardStopBps: 800,
    firstProfitTargetBps: 1800,
    trailingStopBps: 700,
  },
  {
    id: "signal_consensus",
    name: "Signal Consensus",
    summary: "Acts only when independent wallet, market and token evidence agree.",
    approach: "Trades less often and rejects candidates supported by only one source or signal type.",
    defaultAllocationBps: 1500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 25,
    minimumCandidateScore: 85,
    requiresWhaleConfirmation: true,
    maximumHoldingMinutes: 1440,
    hardStopBps: 1000,
    firstProfitTargetBps: 2200,
    trailingStopBps: 900,
    evidenceStatus: "ready",
    evidenceMessage: "Uses the independent evidence groups currently recorded for each candidate.",
  },
  {
    id: "breakout_retest",
    name: "Breakout & Retest",
    summary: "Waits for a price breakout, a controlled pullback and renewed buying support.",
    approach: "Avoids chasing the first spike and enters only after the former resistance area holds.",
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
    evidenceMessage: "Uses rolling executable-quote history to confirm the pullback and renewed demand.",
  },
  {
    id: "liquidity_expansion",
    name: "Liquidity Expansion",
    summary: "Looks for growing liquidity accompanied by credible trading activity.",
    approach: "Requires liquidity, transaction quality and holder breadth to improve together.",
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
    evidenceMessage: "Can operate from the verified market, liquidity and holder evidence already collected.",
  },
  {
    id: "social_catalyst",
    name: "Social Catalyst",
    summary: "Looks for market activity supported by independent, credible social attention.",
    approach: "Rejects a single viral source and requires social evidence to agree with market evidence.",
    defaultAllocationBps: 500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 20,
    minimumCandidateScore: 70,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 720,
    hardStopBps: 1000,
    firstProfitTargetBps: 2200,
    trailingStopBps: 900,
    evidenceStatus: "awaiting_data",
    evidenceMessage: "Needs the planned Telegram, Reddit and X evidence feeds before it can trade honestly.",
  },
  {
    id: "recovery_reversal",
    name: "Recovery & Reversal",
    summary: "Looks for a genuine recovery after a sell-off rather than buying a continuing fall.",
    approach: "Requires a recorded decline, stabilisation and renewed demand before entry.",
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
    evidenceMessage: "Uses rolling executable-quote history to distinguish a rebound from a continuing decline.",
  },
  {
    id: "launch_transition",
    name: "Launch Transition",
    summary: "Tracks coins moving from launch-stage trading into established market liquidity.",
    approach: "Requires confirmed launch-state events and a successful transition to tradable liquidity.",
    defaultAllocationBps: 500,
    maximumConcurrentPositions: 2,
    riskPerTradeBps: 20,
    minimumCandidateScore: 65,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 360,
    hardStopBps: 1000,
    firstProfitTargetBps: 2500,
    trailingStopBps: 900,
    evidenceStatus: "awaiting_data",
    evidenceMessage: "Needs launch-platform events and transition confirmation before it can trade.",
  },
  {
    id: "scalper",
    name: "Bounded Scalper",
    summary: "Takes small, short-lived paper positions when immediate momentum and liquidity agree.",
    approach: "Uses strict position, time and loss limits; it cannot bypass token-security checks.",
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
    evidenceMessage: "Can operate from current quotes, liquidity, momentum and transaction-quality evidence.",
  },
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
    if (!Number.isSafeInteger(allocation.allocationBps) || allocation.allocationBps < 0 || allocation.allocationBps > 10_000)
      throw new RangeError("Profile allocation must be between 0% and 100%");
    if (allocation.enabled && allocation.mode === "automatic_paper" && allocation.allocationBps === 0)
      throw new RangeError("Automatic paper trading requires a positive allocation");
    if (allocation.enabled) allocatedBps += allocation.allocationBps;
  }
  if (allocatedBps > 10_000) throw new RangeError("Enabled profile allocations exceed the paper portfolio");
  return Object.freeze({ allocatedBps, unallocatedBps: 10_000 - allocatedBps });
}
