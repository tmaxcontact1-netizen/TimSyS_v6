import { describe, expect, it } from "vitest";
import { RegimeWatchlist } from "../../src/domain/strategy/regime-watch.js";
import { scheduleObservations } from "../../src/domain/strategy/observation-scheduler.js";
import { evaluateOscillation, type OscillationPoint } from "../../src/domain/strategy/oscillation.js";

describe("persistent regime watch and observation density", () => {
  it("pins a token after five consecutive qualifications and expires sustained decay", () => {
    const watch = new RegimeWatchlist();
    for (let cycle = 0; cycle < 5; cycle += 1)
      watch.register("mint-a", "oscillation_trader", 70, cycle * 60_000);
    expect(watch.getActive(5 * 60_000)[0]?.pinned).toBe(true);
    for (let cycle = 0; cycle < 3; cycle += 1)
      watch.register("mint-a", "oscillation_trader", 30, (11 + cycle) * 60_000);
    expect(watch.isQualified("mint-a", "oscillation_trader", 14 * 60_000)).toBe(false);
  });

  it("allocates eight pinned and eight rotating slots independently", () => {
    const candidates = Array.from({ length: 50 }, (_, index) => ({
      mint: `mint-${index}`, pinned: index < 12,
      lastObservedAt: "2026-09-25T00:00:00.000Z", priority: 100 - index,
    }));
    const selected = scheduleObservations(candidates, "2026-09-25T00:01:00.000Z");
    expect(selected).toHaveLength(16);
    expect(selected.filter((candidate) => candidate.pinned)).toHaveLength(8);
    expect(selected.filter((candidate) => !candidate.pinned)).toHaveLength(8);
  });

  it("sustains production cadence for fifty tokens and pins at least eight within thirty minutes", () => {
    const watch = new RegimeWatchlist();
    const lastSeen = new Map<string, string | null>(Array.from({ length: 50 }, (_, i) => [`mint-${i}`, null]));
    const histories = new Map<string, OscillationPoint[]>();
    const eligibleTokens = new Set<string>();
    for (let second = 0; second <= 30 * 60; second += 15) {
      const now = new Date(Date.parse("2026-09-25T00:00:00Z") + second * 1000).toISOString();
      const active = new Set(watch.getActive(Date.parse(now)).filter((entry) => entry.pinned).map((entry) => entry.mint));
      const selected = scheduleObservations([...lastSeen].map(([mint, lastObservedAt], index) => ({
        mint, lastObservedAt, pinned: active.has(mint), priority: 50 - index,
      })), now);
      for (const candidate of selected) {
        lastSeen.set(candidate.mint, now);
        const index = Number(candidate.mint.split("-")[1]);
        const history = histories.get(candidate.mint) ?? [];
        const sample = history.length, phase = sample % 20;
        const price = index < 10
          ? phase < 15 ? (phase % 2 === 0 ? 1.006 : .994)
            : [1.001, .988, .974, .945, .958][phase - 15]!
          : 1 + .00001 * sample;
        history.push({ observedAt: now, outputAmountRaw: BigInt(Math.round(1e15 / price)),
          liquidityUsd: "250000", fiveMinuteVolumeUsd: "40000",
          fiveMinuteBuys: 70n, fiveMinuteSells: 20n });
        histories.set(candidate.mint, history);
        const assessment = evaluateOscillation(history, {
          watched: watch.isQualified(candidate.mint, "oscillation_trader", Date.parse(now)),
        });
        watch.register(candidate.mint, "oscillation_trader", assessment.score, Date.parse(now));
        if (assessment.eligible) eligibleTokens.add(candidate.mint);
      }
    }
    const pinned = watch.getActive(Date.parse("2026-09-25T00:30:00Z")).filter((entry) => entry.pinned);
    expect(pinned).toHaveLength(8);
    expect(eligibleTokens.size / 50).toBeGreaterThanOrEqual(.10);
  });
});
