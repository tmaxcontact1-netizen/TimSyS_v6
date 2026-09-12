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
  it("allows momentum profiles to qualify strong evidence without a whale signal", () => {
    expect(evaluateProfileCandidate(tradingProfile("fast_furious")!, score, []).eligible).toBe(true);
    expect(evaluateProfileCandidate(tradingProfile("trend_detector")!, score, []).eligible).toBe(true);
  });

  it("keeps whale-dependent and defensive profiles selective", () => {
    expect(evaluateProfileCandidate(tradingProfile("whale_tracker")!, score, []).eligible).toBe(false);
    expect(evaluateProfileCandidate(tradingProfile("capital_preservation")!, score, []).eligible).toBe(false);
  });

  it("never lets a profile override a failed safety gate", () => {
    const decision = evaluateProfileCandidate(
      tradingProfile("fast_furious")!,
      score,
      ["TOK-001"],
    );
    expect(decision.eligible).toBe(false);
    expect(decision.reasons[0]).toContain("TOK-001");
  });

  it("requires every signal family for the consensus profile", () => {
    const almostComplete = { wallet: 30, liquidity: 20, momentum: 20, holders: 15, volumeQuality: 0, total: 85 };
    expect(evaluateProfileCandidate(tradingProfile("signal_consensus")!, almostComplete, []).eligible).toBe(false);
  });
});
