import { describe, expect, it } from "vitest";

import { evaluateShortHorizonSignal } from "../../src/domain/strategy/short-horizon.js";

const points = (...outputs: bigint[]) =>
  outputs.map((outputAmountRaw, index) => ({
    observedAt: new Date(Date.UTC(2026, 8, 15, 12, 0, index)).toISOString(),
    outputAmountRaw,
  }));

describe("short-horizon strategy evidence", () => {
  it("waits for a real executable-price sequence", () => {
    expect(evaluateShortHorizonSignal("fast_furious", points(1000n, 990n))).toMatchObject({
      eligible: false,
      pattern: "insufficient_history",
    });
  });

  it("recognises sustained executable momentum for Fast & Furious", () => {
    const result = evaluateShortHorizonSignal("fast_furious", points(10_000n, 9_900n, 9_800n));
    expect(result.eligible).toBe(true);
    expect(result.pattern).toBe("momentum");
    expect(result.latestMoveBps).toBeGreaterThan(0);
  });

  it("recognises a bounded pullback and rebound for fast profiles", () => {
    const sequence = points(10_000n, 10_100n, 10_020n);
    expect(evaluateShortHorizonSignal("fast_furious", sequence).pattern).toBe("pullback_rebound");
    expect(evaluateShortHorizonSignal("scalper", sequence).eligible).toBe(true);
  });

  it("does not turn noise or a continuing fall into a signal", () => {
    expect(
      evaluateShortHorizonSignal("fast_furious", points(10_000n, 10_100n, 10_200n)).eligible,
    ).toBe(false);
    expect(
      evaluateShortHorizonSignal("scalper", points(10_000n, 10_001n, 10_000n)).eligible,
    ).toBe(false);
  });
});
