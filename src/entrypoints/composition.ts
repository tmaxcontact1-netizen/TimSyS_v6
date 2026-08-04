import type { Pool } from "pg";
import type { PositionWorkerCheckpointRepository } from "../application/ports/repositories.js";
import type {
  PositionRuntimeActionDispatcher,
  PositionRuntimeStepSource,
  ReconciliationEscalationPort,
} from "../application/ports/runtime.js";
import type { RuntimeConfig } from "../infrastructure/config/load-config.js";
import type { PositionId } from "../domain/shared/types.js";
import { PostgresReconciliationJobStore } from "../infrastructure/database/job-store.js";
import { PostgresPositionWorkerCheckpointRepository } from "../infrastructure/database/repositories.js";
import { SystemSchedulerClock } from "../infrastructure/runtime/system-clock.js";
import { runReconciliationWorkerCycle } from "../workers/reconciliation-worker.js";
import type { PositionJobSupervisorDependencies } from "../workers/supervisor.js";

export interface CompletedPositionServices {
  readonly steps: PositionRuntimeStepSource;
  readonly actions: PositionRuntimeActionDispatcher;
  readonly escalation: ReconciliationEscalationPort;
}
export interface PositionRuntimeComposition {
  readonly checkpoints: PositionWorkerCheckpointRepository;
  readonly supervisor: PositionJobSupervisorDependencies;
}

/** Composes concrete runtime/database infrastructure around validated provider services. */
export function composePositionRuntime(input: {
  readonly config: RuntimeConfig;
  readonly database: Pool;
  readonly services: CompletedPositionServices;
  readonly signal: AbortSignal;
}): PositionRuntimeComposition {
  if (input.config.execution === null)
    throw new Error("Position execution runtime requires an execution-enabled operating mode");
  const clock = new SystemSchedulerClock();
  const jobs = new PostgresReconciliationJobStore(input.database);
  const checkpoints = new PostgresPositionWorkerCheckpointRepository(input.database);
  const worker = {
    checkpoints,
    steps: input.services.steps,
    actions: input.services.actions,
    jobs,
    escalation: input.services.escalation,
    ownerId: input.config.instanceId,
    now: () => clock.now(),
  };
  return Object.freeze({
    checkpoints,
    supervisor: Object.freeze({
      jobs,
      now: () => clock.now(),
      run: (positionId: PositionId) => runReconciliationWorkerCycle(positionId, worker),
      wait: clock,
      signal: input.signal,
    }),
  });
}
