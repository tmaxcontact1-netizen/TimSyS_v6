export const profileIds = [
  "whale_tracker",
  "fast_furious",
  "slow_steady",
  "trend_detector",
  "capital_preservation",
  "signal_consensus",
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
    minimumCandidateScore: 75,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 180,
    hardStopBps: 1000,
    firstProfitTargetBps: 1500,
    trailingStopBps: 800,
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
    minimumCandidateScore: 78,
    requiresWhaleConfirmation: false,
    maximumHoldingMinutes: 720,
    hardStopBps: 1200,
    firstProfitTargetBps: 2000,
    trailingStopBps: 1000,
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
    if (allocation.enabled && allocation.allocationBps === 0)
      throw new RangeError("An enabled profile requires a positive allocation");
    if (allocation.enabled) allocatedBps += allocation.allocationBps;
  }
  if (allocatedBps > 10_000) throw new RangeError("Enabled profile allocations exceed the paper portfolio");
  return Object.freeze({ allocatedBps, unallocatedBps: 10_000 - allocatedBps });
}
