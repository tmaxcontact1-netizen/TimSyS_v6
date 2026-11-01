import { describe, expect, test } from "vitest";

import { allocateOtProbeSlots } from "../../src/domain/strategy/observation-runtime.js";
import {
  evaluateOscillation,
  type OscillationPoint,
} from "../../src/domain/strategy/oscillation.js";

interface Progression {
  readonly elapsedMinutes: number;
  readonly stages: readonly string[];
}

function coldStart(candidateCount: number): Progression {
  // These are the five persisted scheduler stores and deliberately start empty.
  const observations = new Map<string, OscillationPoint[]>();
  const watches = new Set<string>();
  const probeAssignments = new Set<string>();
  const evaluationWatermarks = new Map<string, string>();
  const queue: string[] = [];
  expect(observations.size + watches.size + probeAssignments.size + evaluationWatermarks.size + queue.length).toBe(0);

  const stages = ["discovery"];
  const candidates = Array.from({ length: candidateCount }, (_, index) => ({
    tokenMint: `token-${String(index).padStart(3, "0")}`,
    fairnessRank: index,
    volatilityRank: candidateCount - index,
  }));
  stages.push("security");
  allocateOtProbeSlots(candidates).forEach(({ tokenMint }) => probeAssignments.add(tokenMint));
  stages.push("probe");
  const target = [...probeAssignments][0]!;
  const start = Date.parse("2026-09-25T00:00:00Z");
  for (let tick = 0; tick < 120; tick += 1) {
    for (const mint of probeAssignments) {
      const history = observations.get(mint) ?? [];
      const tail = [100.1, 98.8, 97.4, 94.5, 95.8, 96.1];
      const price = tick >= 82 ? tail[Math.min(tail.length - 1, tick - 82)]! : tick % 2 ? 99.4 : 100.6;
      const point: OscillationPoint = {
        observedAt: new Date(start + tick * 15_000).toISOString(),
        outputAmountRaw: BigInt(Math.round((10_000 / price) * 1_000_000)),
        liquidityUsd: "100000",
        fiveMinuteVolumeUsd: tick >= 82 ? "8000" : "5000",
        fiveMinuteBuys: 52n,
        fiveMinuteSells: 48n,
      };
      history.push(point);
      observations.set(mint, history);
      evaluationWatermarks.set(mint, point.observedAt);
      const assessment = evaluateOscillation(history, { watched: watches.has(mint) });
      if (assessment.regimeQualified && !watches.has(mint)) {
        watches.add(mint);
        if (mint === target) stages.push("watch");
      }
      if (mint === target && assessment.eligible) {
        stages.push("entry eligibility");
        return { elapsedMinutes: tick / 4, stages };
      }
    }
  }
  throw new Error("Cold-start fixture did not reach entry eligibility");
}

describe("production-cadence observation cold start", () => {
  test("records discovery-to-entry elapsed time from completely empty scheduler state", () => {
    const result = coldStart(1);
    console.info(JSON.stringify({ event: "cold_start_progression", candidates: 1, ...result }));
    expect(result.stages).toEqual([
      "discovery",
      "security",
      "probe",
      "watch",
      "entry eligibility",
    ]);
    expect(result.elapsedMinutes).toBeGreaterThanOrEqual(20);
  });

  test("fifty competing tokens do not degrade first eligibility beyond twice the single-token path", () => {
    const single = coldStart(1);
    const competing = coldStart(50);
    console.info(JSON.stringify({ event: "cold_start_scaling", single, competing }));
    expect(competing.elapsedMinutes).toBeLessThanOrEqual(single.elapsedMinutes * 2);
  });
});
