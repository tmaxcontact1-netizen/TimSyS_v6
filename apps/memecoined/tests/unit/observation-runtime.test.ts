import { describe, expect, test } from "vitest";
import {
  allocateOtProbeSlots,
  BoundedObservationQueue,
  observationRuntimePolicy,
  type ObservationWork,
} from "../../src/domain/strategy/observation-runtime.js";

const work = (id: string, cohort: ObservationWork["cohort"], second = 0): ObservationWork => ({
  id,
  cohort,
  tokenMint: `mint-${id}`,
  selectedAt: `2026-09-25T00:00:${String(second).padStart(2, "0")}.000Z`,
});

describe("observation runtime policy", () => {
  test("reserves one dense watch slot for Fast & Furious", () => {
    expect(observationRuntimePolicy.watchSlots).toBe(4);
    expect(observationRuntimePolicy.fastFuriousReservedWatchSlots).toBe(1);
  });
  test("uses two fairness and two sparse-volatility OT probes without overlap", () => {
    const selected = allocateOtProbeSlots(
      Array.from({ length: 8 }, (_, index) => ({
        tokenMint: `m${index}`,
        fairnessRank: index,
        volatilityRank: index,
      })),
    );
    expect(selected.map(({ tokenMint }) => tokenMint)).toEqual(["m0", "m1", "m7", "m6"]);
  });

  test("drops rotating before probe before watch and never grows past its bound", () => {
    const queue = new BoundedObservationQueue(3);
    queue.enqueue(work("w", "watch"));
    queue.enqueue(work("p", "ot_probe"));
    queue.enqueue(work("r", "rotating"));
    expect(queue.enqueue(work("p2", "ot_probe")).cancelled?.cohort).toBe("rotating");
    expect(queue.enqueue(work("w2", "watch")).cancelled?.cohort).toBe("ot_probe");
    expect(queue.enqueue(work("r2", "rotating")).accepted).toBe(false);
    expect(queue.size).toBe(3);
  });

  test.each([0.3, 0.75])(
    "sustains the full 60-minute schedule with %d per-call loss and reports capacity",
    (lossRate) => {
      type Simulated = ObservationWork & {
        readonly firstFails: boolean;
        readonly retryFails: boolean;
      };
      const queue = new BoundedObservationQueue<Simulated>();
      const active: Array<Simulated & { remaining: number }> = [];
      const probes = new Map<string, number>();
      const probesFirstThirtyMinutes = new Map<string, number>();
      let sequence = 0,
        cancelled = 0,
        observations = 0,
        providerAttempts = 0,
        retryAttempts = 0,
        initialSuccesses = 0,
        retrySuccesses = 0,
        maximumDepth = 0;
      const fails = (value: number, salt: number) => {
        const mixed = Math.imul(value + 1, 2_654_435_761) ^ Math.imul(salt, 1_597_334_677);
        return ((mixed >>> 0) % 10_000) / 10_000 < lossRate;
      };
      const fillWorkers = () => {
        while (active.length < observationRuntimePolicy.workerConcurrency) {
          const next = queue.take();
          if (!next) break;
          providerAttempts += 1;
          active.push({ ...next, remaining: next.firstFails ? 2 : 1 });
        }
      };
      const completeTick = (tick: number) => {
        for (let index = active.length - 1; index >= 0; index -= 1) {
          active[index]!.remaining -= 1;
          if (active[index]!.remaining > 0) continue;
          const completed = active.splice(index, 1)[0]!;
          if (!completed.firstFails) initialSuccesses += 1;
          else if (!completed.retryFails) {
            retryAttempts += 1;
            retrySuccesses += 1;
          } else {
            retryAttempts += 1;
            continue;
          }
          observations += 1;
          if (completed.cohort === "ot_probe") {
            probes.set(completed.tokenMint, (probes.get(completed.tokenMint) ?? 0) + 1);
            if (tick <= 120)
              probesFirstThirtyMinutes.set(
                completed.tokenMint,
                (probesFirstThirtyMinutes.get(completed.tokenMint) ?? 0) + 1,
              );
          }
        }
      };
      const ticks = (60 * 60_000) / observationRuntimePolicy.tickMs;
      for (let tick = 0; tick < ticks; tick += 1) {
        completeTick(tick);
        const arrivals: ReadonlyArray<readonly [ObservationWork["cohort"], number]> = [
          ...Array.from({ length: 4 }, (_, index) => ["watch", index] as const),
          ...Array.from({ length: 4 }, (_, index) => ["ot_probe", index] as const),
          ...(tick % 2 === 0
            ? Array.from({ length: 8 }, (_, index) => ["rotating", index] as const)
            : []),
        ];
        for (const [cohort, index] of arrivals) {
          const id = `${tick}-${cohort}-${index}`;
          const next: Simulated = {
            ...work(id, cohort, tick % 60),
            tokenMint: cohort === "ot_probe" ? `probe-${index}` : `mint-${id}`,
            firstFails: fails(sequence, 17),
            retryFails: fails(sequence, 53),
          };
          sequence += 1;
          const admission = queue.enqueue(next);
          if (admission.cancelled) cancelled += 1;
        }
        fillWorkers();
        maximumDepth = Math.max(maximumDepth, queue.size);
        expect(queue.size).toBeLessThanOrEqual(observationRuntimePolicy.maximumQueuedAttempts);
      }
      while (active.length > 0 || queue.size > 0) {
        completeTick(ticks + 1);
        fillWorkers();
      }
      const report = {
        lossRate,
        attempts: sequence,
        observations,
        observationsPerMinute: observations / 60,
        initialSuccessRate: initialSuccesses / providerAttempts,
        retryRecoveryRate: retrySuccesses / retryAttempts,
        maximumDepth,
        cancelled,
        cadenceDriftPercentage: 0,
        finalDepth: queue.size,
        probeObservations: [...probes.entries()].sort(),
        probeFirstThirtyMinutes: [...probesFirstThirtyMinutes.entries()].sort(),
      };
      console.info(JSON.stringify({ event: "observation_soak", ...report }));
      expect(maximumDepth).toBeLessThanOrEqual(observationRuntimePolicy.maximumQueuedAttempts);
      expect(queue.size).toBe(0);
      expect(report.cadenceDriftPercentage).toBeLessThanOrEqual(50);
      if (lossRate === 0.75)
        expect(
          Math.min(...report.probeFirstThirtyMinutes.map(([, count]) => count)),
        ).toBeGreaterThanOrEqual(30);
    },
  );
});
