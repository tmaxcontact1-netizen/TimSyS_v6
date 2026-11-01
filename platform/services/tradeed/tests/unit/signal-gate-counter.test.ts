import { describe, expect, it } from "vitest";
import { SignalGateCounter } from "../../src/domain/strategy/signal-gate-counter.js";

describe("profile-scoped signal rejection telemetry", () => {
  it("never attributes one strategy's rejection to another strategy", () => {
    const counters = new SignalGateCounter();
    counters.record({ profileId: "fast_furious", mint: "mint-a", reason: "crossings", ts: "2026-09-25T00:00:00Z" });
    counters.record({ profileId: "fast_furious", mint: "mint-b", reason: "crossings", ts: "2026-09-25T00:00:01Z" });
    counters.record({ profileId: "oscillation_trader", mint: "mint-c", reason: "crossings", ts: "2026-09-25T00:00:02Z" });
    expect(counters.count("fast_furious", "crossings")).toBe(2);
    expect(counters.count("oscillation_trader", "crossings")).toBe(1);
    expect(counters.count("fast_furious", "crossings")).not.toBe(counters.count("oscillation_trader", "crossings"));
    expect(counters.totalsByProfile()).toEqual({ fast_furious: 2, oscillation_trader: 1 });
    expect(counters.events()).toHaveLength(3);
  });

  it("retains only the configured high-volume event window while preserving totals", () => {
    const counters = new SignalGateCounter(32);
    for (let index = 0; index < 10_000; index += 1)
      counters.record({ profileId: "fast_furious", mint: `mint-${index}`, reason: "gate", ts: new Date(index * 1_000).toISOString() });
    expect(counters.retainedEventCount()).toBe(32);
    expect(counters.events()[0]?.mint).toBe("mint-9968");
    expect(counters.count("fast_furious", "gate")).toBe(10_000);
  });
});
