import { describe, expect, it } from "vitest";

import {
  evaluateOscillation,
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
});
