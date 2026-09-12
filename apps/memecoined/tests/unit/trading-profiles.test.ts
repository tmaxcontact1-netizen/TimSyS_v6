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
    ]);
    expect(new Set(tradingProfileCatalogue.map(({ id }) => id)).size).toBe(6);
    expect(tradingProfileCatalogue.every(({ hardStopBps }) => hardStopBps > 0)).toBe(true);
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
});
