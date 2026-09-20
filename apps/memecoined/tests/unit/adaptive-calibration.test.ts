import { describe, expect, it } from "vitest";
import { calibrateFastFurious, calibrateProfile, evaluateAdaptiveEntry } from "../../src/domain/strategy/adaptive-calibration.js";

const history = (prices: readonly number[]) => prices.map((price, index) => ({
  observedAt: new Date(Date.UTC(2026, 8, 19, 12, 0, index)).toISOString(),
  outputAmountRaw: BigInt(Math.round(10_000_000 / price)),
}));

describe("Fast & Furious per-token calibration", () => {
  it("refuses to invent a range without enough executable observations", () => {
    expect(calibrateFastFurious(history([1, 1.01, 1, 1.01]), "2026-09-19T12:04:00.000Z"))
      .toMatchObject({ tradeable: false, regime: "insufficient", sampleCount: 4 });
  });

  it("selects a smaller envelope for repeatable micro fluctuations", () => {
    const result = calibrateFastFurious(
      history([1, 1.006, .998, 1.009, 1.001, 1.012, 1.003, 1.014, 1.005, 1.016, 1.007, 1.018]),
      "2026-09-19T12:12:00.000Z",
    );
    expect(result.tradeable).toBe(true);
    expect(result.targetBps).toBeGreaterThanOrEqual(100);
    expect(result.targetBps).toBeLessThanOrEqual(250);
    expect(result.maximumRoundTripCostBps).toBeLessThan(result.targetBps);
  });

  it("widens the envelope for repeatable larger swings", () => {
    const result = calibrateFastFurious(
      history([1, 1.025, .995, 1.035, 1.005, 1.045, 1.01, 1.055, 1.02, 1.06, 1.025, 1.07]),
      "2026-09-19T12:12:00.000Z",
    );
    expect(result.tradeable).toBe(true);
    expect(result.targetBps).toBeGreaterThan(200);
    expect(result.targetBps).toBeLessThanOrEqual(500);
  });

  it("rejects a discontinuous range instead of chasing one jump", () => {
    const result = calibrateFastFurious(
      history([1, 1.002, .999, 1.001, 1, 1.6, 1.001, 1, .999, 1.001, 1, 1.002]),
      "2026-09-19T12:12:00.000Z",
    );
    expect(result.tradeable).toBe(false);
    expect(result.regime).toBe("unstable");
  });

  it("uses materially different envelopes for different strategy purposes", () => {
    const points = history([1, 1.025, .995, 1.035, 1.005, 1.045, 1.01, 1.055, 1.02, 1.06, 1.025, 1.07]);
    const scalper = calibrateProfile("scalper", points, "2026-09-19T12:12:00.000Z")!;
    const trend = calibrateProfile("slow_steady", points, "2026-09-19T12:12:00.000Z")!;
    expect(scalper.model).not.toBe(trend.model);
    expect(scalper.targetBps).toBeLessThan(trend.targetBps);
    expect(scalper.maximumHoldingMinutes).toBeLessThan(trend.maximumHoldingMinutes);
  });

  it("keeps benchmark strategies fixed for honest comparison", () => {
    expect(calibrateProfile("benchmark_momentum", history(Array(12).fill(1)), "2026-09-19T12:12:00.000Z"))
      .toBeNull();
  });

  it("accepts a confirmed short trend that the legacy Fast & Furious labels excluded", () => {
    const calibration = calibrateFastFurious(
      history([1, 1.006, .998, 1.009, 1.001, 1.012, 1.003, 1.014, 1.005, 1.016, 1.007, 1.018]),
      "2026-09-19T12:12:00.000Z",
    );
    expect(evaluateAdaptiveEntry("fast_furious", {
      eligible: false, pattern: "trend", latestMoveBps: -5, shortMoveBps: 60,
      cumulativeMoveBps: 180, observedVolatilityBps: 200, positiveSteps: 4,
      drawdownFromHighBps: 5, volumeChangeBps: 200, liquidityChangeBps: 50,
      buyPressureBps: 5_200, marketConfirmed: true, reason: "Legacy label excluded",
    }, calibration).eligible).toBe(true);
  });

  it("does not turn a calibrated range into an entry without current confirmation", () => {
    const calibration = calibrateFastFurious(
      history([1, 1.006, .998, 1.009, 1.001, 1.012, 1.003, 1.014, 1.005, 1.016, 1.007, 1.018]),
      "2026-09-19T12:12:00.000Z",
    );
    expect(evaluateAdaptiveEntry("fast_furious", {
      eligible: false, pattern: "trend", latestMoveBps: 30, shortMoveBps: 80,
      cumulativeMoveBps: 200, observedVolatilityBps: 220, positiveSteps: 4,
      drawdownFromHighBps: 0, volumeChangeBps: null, liquidityChangeBps: null,
      buyPressureBps: null, marketConfirmed: false, reason: "Unconfirmed",
    }, calibration).eligible).toBe(false);
  });

  it("rejects a price pattern when current market flow does not support the entry", () => {
    const calibration = calibrateFastFurious(
      history([1, 1.006, .998, 1.009, 1.001, 1.012, 1.003, 1.014, 1.005, 1.016, 1.007, 1.018]),
      "2026-09-19T12:12:00.000Z",
    );
    const decision = evaluateAdaptiveEntry("fast_furious", {
      eligible: true, pattern: "momentum", latestMoveBps: 20, shortMoveBps: 60,
      cumulativeMoveBps: 180, observedVolatilityBps: 200, positiveSteps: 4,
      drawdownFromHighBps: 5, volumeChangeBps: -900, liquidityChangeBps: -150,
      buyPressureBps: 4_900, marketConfirmed: true, reason: "Price-only confirmation",
    }, calibration);
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toContain("buyers, volume and liquidity");
  });
});
