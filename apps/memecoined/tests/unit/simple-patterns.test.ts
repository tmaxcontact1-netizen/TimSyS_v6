import { describe, expect, test } from "vitest";

import {
  evaluateSimpleFastFurious,
  evaluateSimpleOscillation,
  simpleOscillationAdmissionFromMetrics,
} from "../../src/domain/strategy/simple-patterns.js";

const point = (minute: number, price: number, buys = 55n, sells = 45n) => ({
  observedAt: new Date(Date.UTC(2026, 8, 28, 0, minute)).toISOString(),
  outputAmountRaw: BigInt(Math.round(1_000_000_000 / price)),
  liquidityUsd: "50000",
  fiveMinuteVolumeUsd: "30000",
  fiveMinuteBuys: buys,
  fiveMinuteSells: sells,
});

describe("simplified pattern admission", () => {
  test("Fast & Furious admits a 20-100 bps liquid pullback with 45% buy pressure", () => {
    const decision = evaluateSimpleFastFurious([
      point(0, 100),
      point(1, 100.5),
      point(2, 99.9),
    ]);
    expect(decision).toMatchObject({ eligible: true, rule: "short_pullback_20_to_100_bps" });
  });

  test("Fast & Furious rejects a chased price above the recent pullback band", () => {
    expect(evaluateSimpleFastFurious([point(0, 100), point(1, 100.5), point(2, 100.45)]))
      .toMatchObject({ eligible: false, rule: "price_not_20_bps_below_recent_high" });
  });

  test("Oscillation Trader admits an oversold state after three SMA crossings", () => {
    const prices = Array.from({ length: 26 }, (_, index) =>
      100 + (index % 4 < 2 ? 1.5 : -1.5) - (index === 25 ? 10 : 0));
    const decision = evaluateSimpleOscillation(prices.map((price, index) => point(index, price)));
    expect(decision.smaCrossings).toBeGreaterThanOrEqual(3);
    expect(decision.eligible).toBe(true);
  });

  test("Oscillation Trader rejects neutral prices despite oscillation", () => {
    const prices = Array.from({ length: 26 }, (_, index) => 100 + (index % 4 < 2 ? 1 : -1));
    const decision = evaluateSimpleOscillation(prices.map((price, index) => point(index, price)));
    expect(decision.smaCrossings).toBeGreaterThanOrEqual(3);
    expect(decision.eligible).toBe(false);
    expect(decision.rule).toBe("price_not_oversold");
  });

  test("replays the six checkpoint trades through the simplified admission", () => {
    const replay = [
      ["3iUTyN winner 1", 60, 31, 29.6943, -1.2287, true],
      ["3iUTyN winner 2", 60, 27, 27.9643, -1.45, true],
      ["3iUTyN loser", 60, 28, 29.8269, -1.5055, true],
      ["98kfF7", 39, 13, 6.2278, -1.9137, true],
      ["8DXqVU", 58, 8, 29.902, -1.1549, true],
      ["CbcyNo", 58, 6, 34.6307, -1.1255, false],
    ] as const;
    const outcomes = replay.map(([name, observationCount, smaCrossings, rsi, zScore, expected]) => ({
      name,
      expected,
      actual: simpleOscillationAdmissionFromMetrics({
        observationCount, smaCrossings, rsi, zScore, liquidityUsd: 50_000,
      }).eligible,
    }));
    expect(outcomes).toEqual(replay.map(([name,,,,, expected]) => ({ name, expected, actual: expected })));
  });
});
