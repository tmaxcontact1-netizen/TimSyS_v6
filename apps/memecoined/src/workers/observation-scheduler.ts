import { asTimestamp, type Timestamp } from "../domain/shared/types.js";
import type { ObservationCohort } from "../domain/strategy/observation-runtime.js";
import { observationRuntimePolicy } from "../domain/strategy/observation-runtime.js";
import type { SupervisorWaitPort } from "./supervisor.js";

export interface ObservationSchedulerDependencies {
  readonly signal: AbortSignal;
  readonly wait: SupervisorWaitPort;
  readonly now?: () => Date;
  readonly runTick: (
    input: Readonly<{
      scheduledAt: Timestamp;
      allowedCohorts: ReadonlySet<ObservationCohort>;
      overlapDetected: boolean;
    }>,
  ) => Promise<void>;
}

export interface ObservationSchedulerResult {
  readonly ticksScheduled: number;
  readonly ticksSkipped: number;
  readonly maximumConcurrentTicks: number;
}

/** Timer authority is independent of acquisition, evaluation, entry and position supervision. */
export async function runObservationScheduler(
  dependencies: ObservationSchedulerDependencies,
): Promise<ObservationSchedulerResult> {
  const now = dependencies.now ?? (() => new Date());
  const active = new Set<Promise<void>>();
  let failure: unknown = null;
  let ticksScheduled = 0,
    ticksSkipped = 0,
    maximumConcurrentTicks = 0;
  let tickIndex = 0;
  let nextAt =
    Math.ceil(now().getTime() / observationRuntimePolicy.tickMs) * observationRuntimePolicy.tickMs;
  while (!dependencies.signal.aborted) {
    if (failure !== null) throw failure;
    const delay = Math.max(0, nextAt - now().getTime());
    if (delay > 0) await dependencies.wait.wait(delay, dependencies.signal);
    if (dependencies.signal.aborted) break;
    const scheduledAt = asTimestamp(new Date(nextAt));
    nextAt += observationRuntimePolicy.tickMs;
    const rotatingDue = tickIndex % observationRuntimePolicy.rotatingEveryTicks === 0;
    tickIndex += 1;
    const allowed: ReadonlySet<ObservationCohort> =
      new Set(rotatingDue ? ["watch", "ot_probe", "rotating"] : ["watch", "ot_probe"]);
    const task = dependencies
      .runTick({ scheduledAt, allowedCohorts: allowed, overlapDetected: active.size > 0 })
      .catch((error) => {
        failure = error;
      });
    active.add(task);
    ticksScheduled += 1;
    maximumConcurrentTicks = Math.max(maximumConcurrentTicks, active.size);
    void task.finally(() => active.delete(task));
  }
  await Promise.allSettled(active);
  if (failure !== null) throw failure;
  return Object.freeze({ ticksScheduled, ticksSkipped, maximumConcurrentTicks });
}
