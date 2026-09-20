import { describe, expect, it } from "vitest";

import { analyseExecutableHistory, buildExecutableBars } from "../../src/domain/strategy/technical-analysis.js";

const points = (prices: readonly number[], spacingMinutes = 1) => prices.map((price, index) => ({
  observedAt: new Date(Date.UTC(2026, 8, 20, 12, index * spacingMinutes)).toISOString(),
  outputAmountRaw: BigInt(Math.round(10_000_000 / price)),
}));

describe("executable-price technical analysis", () => {
  it("constructs explicitly sampled OHLC bars without inventing unseen prices", () => {
    const bars = buildExecutableBars(points([1, 1.01, .99, 1.02, 1.03, 1.04]));
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ samples: 5 });
    expect(bars[0]!.high).toBeGreaterThan(bars[0]!.low);
  });

  it("recognises a positive trend without mistaking a straight-line chase for a safe entry", () => {
    const result = analyseExecutableHistory(points(Array.from({ length: 40 }, (_, index) => 1 + index * .002)));
    expect(result.emaFast).toBeGreaterThan(result.emaSlow);
    expect(result.emaSlopeBps).toBeGreaterThan(0);
    expect(result.efficiencyRatio).toBeGreaterThan(.9);
    expect(result.overextended).toBe(true);
  });

  it("marks an extreme chase as overextended", () => {
    const sequence = [...Array.from({ length: 30 }, (_, index) => 1 + index * .001), 1.2, 1.35];
    expect(analyseExecutableHistory(points(sequence)).overextended).toBe(true);
  });
});
