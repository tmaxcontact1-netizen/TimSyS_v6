import { describe, expect, it } from "vitest";

import {
  tradingProfileCatalogue,
  validateConcurrentProfileAllocation,
} from "../../src/domain/strategy/profiles.js";

describe("trading profiles", () => {
  it("ships the complete operator catalogue with unique profiles", () => {
    expect(tradingProfileCatalogue.map(({ id }) => id)).toEqual([
      "whale_tracker",
      "fast_furious",
      "slow_steady",
      "trend_detector",
      "capital_preservation",
      "signal_consensus",
      "breakout_retest",
      "liquidity_expansion",
      "social_catalyst",
      "recovery_reversal",
      "launch_transition",
      "scalper",
      "benchmark_buy_hold",
      "benchmark_momentum",
      "benchmark_ema_cross",
      "benchmark_rsi_reversal",
      "benchmark_macd_trend",
      "benchmark_bollinger_reversion",
      "benchmark_donchian_breakout",
      "benchmark_volume_breakout",
      "benchmark_atr_trend",
    ]);
    expect(new Set(tradingProfileCatalogue.map(({ id }) => id)).size).toBe(21);
    expect(tradingProfileCatalogue.every(({ hardStopBps }) => hardStopBps > 0)).toBe(true);
  });

  it("does not claim profiles can trade before their required evidence exists", () => {
    const waiting = tradingProfileCatalogue.filter(({ evidenceStatus }) => evidenceStatus === "awaiting_data");
    expect(waiting.map(({ id }) => id)).toEqual([
      "social_catalyst", "launch_transition",
    ]);
    expect(waiting.every(({ evidenceMessage }) => Boolean(evidenceMessage))).toBe(true);
  });

  it("allows concurrent profiles only inside the shared allocation boundary", () => {
    expect(
      validateConcurrentProfileAllocation([
        { profileId: "whale_tracker", enabled: true, mode: "automatic_paper", allocationBps: 4000 },
        { profileId: "trend_detector", enabled: true, mode: "automatic_paper", allocationBps: 6000 },
      ]),
    ).toEqual({ allocatedBps: 10_000, unallocatedBps: 0 });
    expect(() =>
      validateConcurrentProfileAllocation([
        { profileId: "whale_tracker", enabled: true, mode: "automatic_paper", allocationBps: 5000 },
        { profileId: "trend_detector", enabled: true, mode: "automatic_paper", allocationBps: 5001 },
      ]),
    ).toThrow(/exceed/i);
  });

  it("allows zero-allocation observation profiles but not automatic traders", () => {
    expect(validateConcurrentProfileAllocation([
      { profileId: "social_catalyst", enabled: true, mode: "observe", allocationBps: 0 },
    ])).toEqual({ allocatedBps: 0, unallocatedBps: 10_000 });
    expect(() => validateConcurrentProfileAllocation([
      { profileId: "scalper", enabled: true, mode: "automatic_paper", allocationBps: 0 },
    ])).toThrow(/positive allocation/i);
  });

  it("keeps independent benchmark capital outside the operational allocation", () => {
    expect(validateConcurrentProfileAllocation([
      { profileId: "fast_furious", enabled: true, mode: "automatic_paper", allocationBps: 10_000 },
      { profileId: "benchmark_ema_cross", enabled: true, mode: "automatic_paper", allocationBps: 10_000 },
      { profileId: "benchmark_rsi_reversal", enabled: true, mode: "automatic_paper", allocationBps: 10_000 },
    ])).toEqual({ allocatedBps: 10_000, unallocatedBps: 0 });
  });
});
