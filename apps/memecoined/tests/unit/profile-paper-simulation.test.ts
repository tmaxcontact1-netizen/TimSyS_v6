import { describe, expect, it } from "vitest";

import { evaluateProfileCandidate } from "../../src/application/services/profile-paper-simulation.js";
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
  it("keeps evidence-dependent profiles in observation until their feeds exist", () => {
    const result = evaluateProfileCandidate(tradingProfile("social_catalyst")!, score, []);
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/Telegram, Reddit and X/i);
  });

  it("gives liquidity expansion and scalping distinct deterministic gates", () => {
    expect(evaluateProfileCandidate(tradingProfile("liquidity_expansion")!, score, []).eligible).toBe(false);
    expect(evaluateProfileCandidate(tradingProfile("scalper")!, score, []).eligible).toBe(false);
    const active = { ...score, total: 90, liquidity: 20, momentum: 20, holders: 10, volumeQuality: 15 };
    expect(evaluateProfileCandidate(tradingProfile("liquidity_expansion")!, active, []).eligible).toBe(true);
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

  it("keeps whale-dependent and defensive profiles selective", () => {
    expect(evaluateProfileCandidate(tradingProfile("whale_tracker")!, score, []).eligible).toBe(
      false,
    );
    expect(
      evaluateProfileCandidate(tradingProfile("capital_preservation")!, score, []).eligible,
    ).toBe(false);
  });

  it("never lets a profile override a failed safety gate", () => {
    const decision = evaluateProfileCandidate(tradingProfile("fast_furious")!, score, ["SEC-001"]);
    expect(decision.eligible).toBe(false);
    expect(decision.reasons[0]).toContain("SEC-001");
  });

  it("lets the aggressive paper profile treat market range as profile evidence, not universal safety", () => {
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
        "SEC-005",
        "SEC-007",
        "SEC-010",
        "UNI-003",
        "UNI-004",
      ]).eligible,
    ).toBe(true);
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
      wallet: 30,
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
});
