import { describe, expect, it } from "vitest";
import { calibrateFastFurious, calibrateProfile, evaluateAdaptiveEntry } from "../../src/domain/strategy/adaptive-calibration.js";

const history = (prices: readonly number[]) => prices.map((price, index) => ({
  observedAt: new Date(Date.UTC(2026, 8, 19, 12, 0, index)).toISOString(),
  outputAmountRaw: BigInt(Math.round(10_000_000 / price)),
}));

const confirmedTechnical = {
  sampleCount: 30, barCount: 6, rsi: 58, priorRsi: 55,
  emaFast: 10_100, emaSlow: 10_000, emaSpreadBps: 100, emaSlopeBps: 20,
  macdHistogramBps: 12, bollingerPosition: .35, atrBps: 80,
  efficiencyRatio: .55, accelerationBps: 15, bullishClose: true,
  historyReturnBps: 240, maximumDrawdownBps: 180, recoveryFromLowBps: 300,
  higherLows: true, overextended: false, qualityScore: 82, bars: [],
} as const;

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
      buyPressureBps: 5_200, liquidityPositiveSteps: 4, volumePositiveSteps: 4, marketConfirmed: true, reason: "Legacy label excluded",
      technical: confirmedTechnical,
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
      buyPressureBps: null, liquidityPositiveSteps: 0, volumePositiveSteps: 0, marketConfirmed: false, reason: "Unconfirmed",
      technical: confirmedTechnical,
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
      buyPressureBps: 4_900, liquidityPositiveSteps: 2, volumePositiveSteps: 2, marketConfirmed: true, reason: "Price-only confirmation",
      technical: confirmedTechnical,
    }, calibration);
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toContain("buyers, volume and liquidity");
  });

  it("requires each strategy to prove its own mathematical thesis", () => {
    const points = history([1, 1.006, .998, 1.009, 1.001, 1.012, 1.003, 1.014, 1.005, 1.016, 1.007, 1.018]);
    const signal = {
      eligible: true as const, pattern: "trend" as const, latestMoveBps: 20, shortMoveBps: 60,
      cumulativeMoveBps: 180, observedVolatilityBps: 200, positiveSteps: 4,
      drawdownFromHighBps: 5, volumeChangeBps: 200, liquidityChangeBps: 50,
      buyPressureBps: 5_500, liquidityPositiveSteps: 4, volumePositiveSteps: 4, marketConfirmed: true, reason: "Shared market evidence",
      technical: { ...confirmedTechnical, sampleCount: 20, qualityScore: 55, efficiencyRatio: .24 },
    };
    expect(evaluateAdaptiveEntry("fast_furious", signal, calibrateProfile("fast_furious", points, "2026-09-19T12:12:00.000Z"))).toMatchObject({ eligible: true });
    expect(evaluateAdaptiveEntry("slow_steady", signal, calibrateProfile("slow_steady", points, "2026-09-19T12:12:00.000Z"))).toMatchObject({ eligible: false });
  });

  it("never chases a mathematically overextended move", () => {
    const calibration = calibrateFastFurious(
      history([1, 1.006, .998, 1.009, 1.001, 1.012, 1.003, 1.014, 1.005, 1.016, 1.007, 1.018]),
      "2026-09-19T12:12:00.000Z",
    );
    const decision = evaluateAdaptiveEntry("fast_furious", {
      eligible: true, pattern: "momentum", latestMoveBps: 80, shortMoveBps: 160,
      cumulativeMoveBps: 350, observedVolatilityBps: 400, positiveSteps: 5,
      drawdownFromHighBps: 0, volumeChangeBps: 500, liquidityChangeBps: 100,
      buyPressureBps: 6_000, liquidityPositiveSteps: 5, volumePositiveSteps: 5, marketConfirmed: true, reason: "Strong but late",
      technical: { ...confirmedTechnical, rsi: 84, overextended: true, qualityScore: 45 },
    }, calibration);
    expect(decision).toMatchObject({ eligible: false });
    expect(decision.reason).toContain("overextended");
  });

  it("rejects the observed collapse-and-rebound false positive for every affected thesis", () => {
    const rebound = {
      eligible: false, pattern: "none" as const, latestMoveBps: 0, shortMoveBps: 250,
      cumulativeMoveBps: 500, observedVolatilityBps: 550, positiveSteps: 4,
      drawdownFromHighBps: 0, volumeChangeBps: 10_784, liquidityChangeBps: 299,
      buyPressureBps: 5_520, liquidityPositiveSteps: 3, volumePositiveSteps: 4,
      marketConfirmed: true, reason: "Temporary rebound inside a collapse",
      technical: {
        ...confirmedTechnical, qualityScore: 74, rsi: 62.7, emaSlopeBps: 103.6,
        macdHistogramBps: 72, accelerationBps: 983.1, efficiencyRatio: .088,
        higherLows: false, historyReturnBps: -465.5, maximumDrawdownBps: 1_515,
        recoveryFromLowBps: 1_196,
      },
    };
    const points = history(Array.from({ length: 40 }, (_, index) => index < 30 ? 1 - index * .004 : .884 + (index - 30) * .007));
    for (const profile of ["fast_furious", "trend_detector", "liquidity_expansion"] as const) {
      const calibration = calibrateProfile(profile, points, "2026-09-20T16:23:26.508Z");
      expect(evaluateAdaptiveEntry(profile, rebound, calibration), profile).toMatchObject({ eligible: false });
    }
  });
});
