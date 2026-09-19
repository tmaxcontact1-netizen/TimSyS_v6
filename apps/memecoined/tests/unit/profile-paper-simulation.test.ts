import { describe, expect, it } from "vitest";

import {
  evaluateExecutableEntryEvidence,
  evaluateProfileCandidate,
  maximumPositionBps,
  refreshTemporalCandidateEvidence,
  trailingStopActivated,
} from "../../src/application/services/profile-paper-simulation.js";
import { asTimestamp } from "../../src/domain/shared/types.js";
import { tradingProfile } from "../../src/domain/strategy/profiles.js";

const score = {
  wallet: 0,
  liquidity: 15,
  momentum: 20,
  holders: 8,
  volumeQuality: 10,
  total: 53,
};

describe("profile paper simulation policy", () => {
  it("uses current market momentum without bypassing live liquidity or holder gates", () => {
    const market = {
      liquidityUsd: { gte: (n: number) => n <= 150_000, lt: (n: number) => n > 150_000 },
      fiveMinutePriceChangePercentage: { gte: (n: number) => n <= 6, lte: (n: number) => n >= 6, toString: () => "6" },
      fiveMinuteBuys: 20n,
      fiveMinuteSells: 10n,
      pairCreatedAt: asTimestamp("2026-09-16T11:00:00.000Z"),
    };
    const refreshed = refreshTemporalCandidateEvidence({
      previousScore: { wallet: 0, holders: 15, liquidity: 0, momentum: 0, volumeQuality: 0, total: 15 },
      previousFailedRules: ["SEC-005", "SEC-008", "SEC-012"],
      scoreEvaluatedAt: asTimestamp("2026-09-16T11:50:00.000Z"),
      observedAt: asTimestamp("2026-09-16T12:00:00.000Z"),
      market: market as never,
    });
    expect(refreshed.score).toMatchObject({ liquidity: 15, momentum: 20, volumeQuality: 10, total: 60 });
    expect(refreshed.failedRules).toEqual(["SEC-008"]);
    expect(evaluateProfileCandidate(tradingProfile("fast_furious")!, refreshed.score, refreshed.failedRules).eligible).toBe(false);
    expect(refreshed.staticEvidenceFresh).toBe(true);
    const stale = refreshTemporalCandidateEvidence({
      previousScore: score,
      previousFailedRules: [],
      scoreEvaluatedAt: asTimestamp("2026-09-16T11:30:00.000Z"),
      observedAt: asTimestamp("2026-09-16T12:00:00.000Z"),
      market: market as never,
    });
    expect(stale.staticEvidenceFresh).toBe(false);
    const unsafe = refreshTemporalCandidateEvidence({
      previousScore: score,
      previousFailedRules: [],
      scoreEvaluatedAt: asTimestamp("2026-09-16T11:50:00.000Z"),
      observedAt: asTimestamp("2026-09-16T12:00:00.000Z"),
      market: { ...market, liquidityUsd: null, fiveMinuteSells: 21n } as never,
    });
    expect(unsafe.failedRules).toContain("SEC-005");
    expect(unsafe.failedRules).toContain("SEC-012");
  });
  it("keeps evidence-dependent profiles in observation until their feeds exist", () => {
    const result = evaluateProfileCandidate(tradingProfile("social_catalyst")!, score, []);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/Telegram, Reddit and X/i);
  });

  it("gives liquidity expansion and scalping distinct deterministic gates", () => {
    expect(
      evaluateProfileCandidate(tradingProfile("liquidity_expansion")!, score, []).eligible,
    ).toBe(false);
    expect(evaluateProfileCandidate(tradingProfile("scalper")!, score, []).eligible).toBe(false);
    const active = {
      ...score,
      total: 90,
      liquidity: 20,
      momentum: 20,
      holders: 10,
      volumeQuality: 15,
    };
    expect(
      evaluateProfileCandidate(tradingProfile("liquidity_expansion")!, active, []).eligible,
    ).toBe(true);
    expect(evaluateProfileCandidate(tradingProfile("scalper")!, active, []).eligible).toBe(true);
  });

  it("allows momentum profiles to qualify strong evidence without a whale signal", () => {
    expect(evaluateProfileCandidate(tradingProfile("fast_furious")!, score, []).eligible).toBe(
      true,
    );
    expect(evaluateProfileCandidate(tradingProfile("trend_detector")!, score, []).eligible).toBe(
      true,
    );
  });

  it("keeps unavailable whale evidence blocked while defensive profiles use current evidence", () => {
    expect(evaluateProfileCandidate(tradingProfile("whale_tracker")!, score, []).eligible).toBe(
      false,
    );
    const defensive = { ...score, liquidity: 20, holders: 15, volumeQuality: 10, total: 65 };
    expect(evaluateProfileCandidate(tradingProfile("capital_preservation")!, defensive, []).eligible).toBe(true);
    expect(evaluateProfileCandidate(tradingProfile("slow_steady")!, defensive, []).eligible).toBe(true);
  });

  it("never lets a profile override a failed safety gate", () => {
    const decision = evaluateProfileCandidate(tradingProfile("fast_furious")!, score, ["SEC-001"]);
    expect(decision.eligible).toBe(false);
    expect(decision.reasons[0]).toContain("SEC-001");
  });

  it("does not make a confirmed adaptive entry pass the obsolete aggregate momentum gate twice", () => {
    const adaptiveScore = {
      wallet: 0,
      liquidity: 15,
      momentum: 0,
      holders: 15,
      volumeQuality: 0,
      total: 30,
    };
    expect(evaluateProfileCandidate(
      tradingProfile("fast_furious")!, adaptiveScore, [], { adaptiveEntryConfirmed: true },
    ).eligible).toBe(true);
    expect(evaluateProfileCandidate(
      tradingProfile("scalper")!, adaptiveScore, [], { adaptiveEntryConfirmed: true },
    ).eligible).toBe(true);
    expect(evaluateProfileCandidate(
      tradingProfile("fast_furious")!, adaptiveScore, ["SEC-005"], { adaptiveEntryConfirmed: true },
    ).eligible).toBe(false);
  });

  it("lets the aggressive profile relax market-cap range without relaxing liquidity or ownership safety", () => {
    const aggressive = {
      wallet: 0,
      liquidity: 0,
      momentum: 20,
      holders: 15,
      volumeQuality: 10,
      total: 45,
    };
    expect(
      evaluateProfileCandidate(tradingProfile("fast_furious")!, aggressive, [
        "SEC-007",
        "UNI-003",
        "UNI-004",
      ]).eligible,
    ).toBe(true);
    expect(
      evaluateProfileCandidate(tradingProfile("fast_furious")!, aggressive, ["SEC-005"]).eligible,
    ).toBe(false);
    expect(
      evaluateProfileCandidate(tradingProfile("fast_furious")!, aggressive, ["SEC-010"]).eligible,
    ).toBe(false);
  });

  it("does not let an aggressive profile ignore concentration or adverse transaction flow", () => {
    const aggressive = {
      wallet: 0,
      liquidity: 0,
      momentum: 20,
      holders: 15,
      volumeQuality: 10,
      total: 45,
    };
    expect(
      evaluateProfileCandidate(tradingProfile("fast_furious")!, aggressive, ["SEC-008"]).eligible,
    ).toBe(false);
    expect(
      evaluateProfileCandidate(tradingProfile("fast_furious")!, aggressive, ["SEC-012"]).eligible,
    ).toBe(false);
  });

  it("requires every signal family for the consensus profile", () => {
    const almostComplete = {
      wallet: 0,
      liquidity: 20,
      momentum: 20,
      holders: 15,
      volumeQuality: 0,
      total: 85,
    };
    expect(
      evaluateProfileCandidate(tradingProfile("signal_consensus")!, almostComplete, []).eligible,
    ).toBe(false);
  });

  it("caps short-horizon exposure independently of an assumed stop fill", () => {
    expect(maximumPositionBps("fast_furious")).toBe(150n);
    expect(maximumPositionBps("scalper")).toBe(100n);
    expect(maximumPositionBps("whale_tracker")).toBe(250n);
  });

  it("rejects stale, shallow and sell-dominated executable entry evidence", () => {
    const decision = evaluateExecutableEntryEvidence({
      profile: tradingProfile("fast_furious")!,
      proposedInputRaw: 20_000_000n,
      proposedOutputRaw: 1_700_000n,
      evidence: {
        observedAt: asTimestamp(new Date("2026-09-16T00:00:00Z")),
        inputAmountRaw: 10_000_000n,
        outputAmountRaw: 1_000_000n,
        liquidityUsd: 20_000,
        fiveMinuteVolumeUsd: 1_000,
        fiveMinuteBuys: 4n,
        fiveMinuteSells: 10n,
      },
      at: asTimestamp(new Date("2026-09-16T00:03:00Z")),
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/two minutes|liquidity|volume|sells|price impact/i);
  });

  it("accepts fresh, liquid evidence whose larger quote remains executable", () => {
    const decision = evaluateExecutableEntryEvidence({
      profile: tradingProfile("fast_furious")!,
      proposedInputRaw: 20_000_000n,
      proposedOutputRaw: 1_990_000n,
      evidence: {
        observedAt: asTimestamp(new Date("2026-09-16T00:00:00Z")),
        inputAmountRaw: 10_000_000n,
        outputAmountRaw: 1_000_000n,
        liquidityUsd: 100_000,
        fiveMinuteVolumeUsd: 25_000,
        fiveMinuteBuys: 12n,
        fiveMinuteSells: 10n,
      },
      at: asTimestamp(new Date("2026-09-16T00:01:00Z")),
    });
    expect(decision).toEqual({ eligible: true, reasons: [] });
  });

  it("does not call an ordinary loss a trailing-stop exit", () => {
    expect(
      trailingStopActivated({ value: 970n, cost: 1_000n, high: 1_010n, trailingBps: 250 }),
    ).toBe(false);
    expect(
      trailingStopActivated({ value: 1_020n, cost: 1_000n, high: 1_050n, trailingBps: 250 }),
    ).toBe(true);
  });
});
