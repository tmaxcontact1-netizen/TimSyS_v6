import { describe, expect, it } from "vitest";

import {
  evaluateOscillation,
  countReturnSignChanges,
  lagOneAutocorrelation,
  type OscillationPoint,
} from "../../src/domain/strategy/oscillation.js";

function points(outputs: readonly number[]): OscillationPoint[] {
  return outputs.map((output, index) => ({
    observedAt: new Date(Date.UTC(2026, 8, 24, 12, 0, index * 45)).toISOString(),
    outputAmountRaw: BigInt(Math.round(output * 1_000_000)),
    liquidityUsd: "100000",
    fiveMinuteVolumeUsd: "5000",
    fiveMinuteBuys: 52n,
    fiveMinuteSells: 48n,
  }));
}

describe("oscillation strategy", () => {
  it("measures negative lag-one dependence without observation-count shortcuts", () => {
    expect(lagOneAutocorrelation([10, -10, 10, -10, 10, -10, 10])).toBeLessThan(-0.9);
  });

  it("detects an oscillating regime from return sign changes without using autocorrelation as a gate", () => {
    expect(countReturnSignChanges([12, -8, 15, -7, 4])).toBe(4);
    const result = evaluateOscillation(points(Array.from({ length: 41 }, (_, i) => i % 2 ? 98.5 : 100)));
    expect(result.returnSignChanges).toBeGreaterThanOrEqual(3);
    expect("autocorrelation" in result.gates).toBe(false);
  });

  it("refuses a short burst even when its prices move", () => {
    const result = evaluateOscillation(points([100, 99, 101, 99, 101, 99, 101]));
    expect(result.eligible).toBe(false);
    expect(result.gates.observations).toBe(false);
    expect(result.reason).toMatch(/coverage/i);
  });

  it("keeps target, stop, hold and friction inside the oscillator's declared bounds", () => {
    const series = Array.from({ length: 41 }, (_, index) => index % 2 === 0 ? 100 : 98.5);
    const result = evaluateOscillation(points(series));
    expect(result.observationCount).toBeGreaterThanOrEqual(30);
    expect(result.targetBps).toBeGreaterThanOrEqual(50);
    expect(result.targetBps).toBeLessThanOrEqual(150);
    expect(result.hardStopBps).toBeGreaterThanOrEqual(35);
    expect(result.maximumHoldingMinutes).toBeGreaterThanOrEqual(3);
    expect(result.maximumHoldingMinutes).toBeLessThanOrEqual(8);
    expect(result.maximumRoundTripCostBps).toBe(Math.floor(result.targetBps * .6));
  });

  it("retains a qualified reversal transition across subsequent observation samples", () => {
    const prefix = Array.from({ length: 35 }, (_, index) => index % 2 ? 99.4 : 100.6);
    const series = [...prefix, 100.1, 98.8, 97.4, 94.5, 95.8, 96.1];
    const result = evaluateOscillation(points(series.map((price) => 10_000 / price)), { watched: true });
    expect(result.signalType).toBe("extreme_oversold");
    expect(result.eligible).toBe(true);
  });
});
