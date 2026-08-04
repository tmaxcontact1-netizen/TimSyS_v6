import type { PositionId } from "../domain/shared/types.js";
import type { PositionWorkerDependencies, PositionWorkerCycleResult } from "./position-worker.js";
import { runPositionWorkerCycle } from "./position-worker.js";

/** Reuses the durable worker protocol with a reconciliation-only step source. */
export async function runReconciliationWorkerCycle(
  positionId: PositionId,
  dependencies: PositionWorkerDependencies,
): Promise<PositionWorkerCycleResult> {
  return runPositionWorkerCycle(positionId, dependencies);
}
