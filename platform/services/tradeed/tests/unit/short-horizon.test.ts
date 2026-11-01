import { describe, expect, it } from "vitest";

import { evaluateShortHorizonSignal } from "../../src/domain/strategy/short-horizon.js";

const points = (...outputs: bigint[]) =>
  outputs.map((outputAmountRaw, index) => ({
    observedAt: new Date(Date.UTC(2026, 8, 15, 12, 0, index)).toISOString(),
    outputAmountRaw,
    liquidityUsd: String(100_000 + index * 100),
    fiveMinuteVolumeUsd: String(20_000 + index * 1_000),
    fiveMinuteBuys: 60n,
    fiveMinuteSells: 40n,
  }));

describe("short-horizon strategy evidence", () => {
  it("waits for a real executable-price sequence", () => {
    expect(evaluateShortHorizonSignal("fast_furious", points(1000n, 990n))).toMatchObject({
      eligible: false,
      pattern: "insufficient_history",
    });
  });

  it("recognises sustained executable momentum for Fast & Furious", () => {
    const result = evaluateShortHorizonSignal(
      "fast_furious",
      points(10_000n, 9_980n, 9_960n, 9_940n, 9_920n, 9_900n),
    );
    expect(result.eligible).toBe(true);
    expect(["momentum", "trend"]).toContain(result.pattern);
    expect(result.latestMoveBps).toBeGreaterThan(0);
    expect(result.marketConfirmed).toBe(true);
  });

  it("recognises a bounded pullback and rebound for fast profiles", () => {
    const sequence = points(10_000n, 10_020n, 10_010n, 10_000n, 9_980n, 9_960n);
    expect(["momentum", "pullback_rebound"]).toContain(
      evaluateShortHorizonSignal("fast_furious", sequence).pattern,
    );
    expect(evaluateShortHorizonSignal("scalper", sequence)).toMatchObject({ eligible: true, pattern: "range_rebound" });
  });

  it("does not turn noise or a continuing fall into a signal", () => {
    expect(
      evaluateShortHorizonSignal(
        "fast_furious",
        points(10_000n, 10_040n, 10_080n, 10_120n, 10_160n, 10_200n),
      ).eligible,
    ).toBe(false);
    expect(
      evaluateShortHorizonSignal(
        "scalper",
        points(10_000n, 10_001n, 10_000n, 10_001n, 10_000n, 10_001n),
      ).eligible,
    ).toBe(false);
  });

  it("does not trade a price pattern without market confirmation", () => {
    const bare = [10_000n, 9_980n, 9_960n, 9_940n, 9_920n, 9_900n].map(
      (outputAmountRaw, index) => ({ observedAt: String(index), outputAmountRaw }),
    );
    const result = evaluateShortHorizonSignal("fast_furious", bare);
    expect(result.pattern).not.toBe("none");
    expect(result.marketConfirmed).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it("runs the passive benchmark from the same confirmed executable evidence", () => {
    const result = evaluateShortHorizonSignal(
      "benchmark_buy_hold",
      points(10_000n, 9_995n, 10_005n, 10_000n, 9_998n, 9_996n),
    );
    expect(result).toMatchObject({ eligible: true, pattern: "buy_hold", marketConfirmed: true });
  });

  it("calculates a classic EMA benchmark from a longer history", () => {
    const sequence = points(...Array.from({ length: 24 }, (_, index) => BigInt(12_000 - index * 25)));
    const result = evaluateShortHorizonSignal("benchmark_ema_cross", sequence);
    expect(result).toMatchObject({ eligible: true, pattern: "ema_cross", indicator: "fast minus slow EMA" });
  });

  it("recognises an evidence-backed young-pool liquidity transition", () => {
    const sequence = points(10_000n, 9_990n, 9_980n, 9_970n, 9_960n, 9_950n)
      .map((point, index) => ({ ...point, liquidityUsd: String(100_000 + index * 3_000), poolAgeMinutes: 240 }));
    expect(evaluateShortHorizonSignal("launch_transition", sequence)).toMatchObject({
      eligible: true,
      pattern: "liquidity_expansion",
    });
  });
});
