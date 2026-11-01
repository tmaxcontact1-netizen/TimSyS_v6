import type { Pool } from "pg";
import type { RuntimeConfig } from "../infrastructure/config/load-config.js";
import {
  verifyRuntimeDatabase,
  type DatabaseReadiness,
} from "../infrastructure/database/migrations.js";
import {
  runPositionJobSupervisor,
  type PositionJobSupervisorDependencies,
  type PositionJobSupervisorResult,
} from "../workers/supervisor.js";
import {
  runObservationScheduler,
  type ObservationSchedulerDependencies,
  type ObservationSchedulerResult,
} from "../workers/observation-scheduler.js";
import { assertPaperEpochConfiguration } from "../application/services/paper-epoch-configuration.js";
import { ensureAllProfilesPaperTrialPreset } from "../infrastructure/database/paper-profile-activations.js";
import type { WalletAddress } from "../domain/shared/types.js";
import { asTimestamp } from "../domain/shared/types.js";
import { reconcileInterruptedProfileEntries } from "../application/services/profile-paper-simulation.js";

export interface ProductionProcessDependencies {
  readonly config: RuntimeConfig;
  readonly database: Pick<Pool, "query" | "end">;
  readonly supervisor: PositionJobSupervisorDependencies;
  readonly observationScheduler?: ObservationSchedulerDependencies;
}
export interface ProductionProcessResult {
  readonly database: DatabaseReadiness;
  readonly supervisor: PositionJobSupervisorResult;
  readonly observationScheduler?: ObservationSchedulerResult;
}

/** Validates durable state before recovery and always drains the database pool on exit. */
export async function runProductionProcess(
  dependencies: ProductionProcessDependencies,
): Promise<ProductionProcessResult> {
  try {
    const database = await verifyRuntimeDatabase(dependencies.database, dependencies.config.mode);
    if (dependencies.config.mode === "paper") {
      if (dependencies.config.paper?.trialPreset === "all_profiles")
        await ensureAllProfilesPaperTrialPreset(
          dependencies.database,
          dependencies.config.paper.walletAddress as WalletAddress,
          new Date(),
        );
      await assertPaperEpochConfiguration(dependencies.database, dependencies.config);
      if (dependencies.config.paper)
        await reconcileInterruptedProfileEntries(
          dependencies.database,
          dependencies.config.paper.walletAddress as WalletAddress,
          asTimestamp(new Date()),
        );
    }
    if (dependencies.supervisor.signal.aborted)
      return Object.freeze({
        database,
        supervisor: Object.freeze({
          recoveredPositionIds: Object.freeze([]),
          batchesCompleted: 0,
          jobsVisited: 0,
          acquisitionCyclesCompleted: 0,
        }),
      });
    const supervisor = runPositionJobSupervisor(dependencies.supervisor);
    if (!dependencies.observationScheduler)
      return Object.freeze({ database, supervisor: await supervisor });
    const [supervisorResult, observationScheduler] = await Promise.all([
      supervisor,
      runObservationScheduler(dependencies.observationScheduler),
    ]);
    return Object.freeze({ database, supervisor: supervisorResult, observationScheduler });
  } finally {
    await dependencies.database.end();
  }
}

export function installShutdownSignals(
  controller: AbortController,
  processPort: Pick<NodeJS.Process, "once" | "removeListener"> = process,
): () => void {
  const shutdown = () => controller.abort();
  processPort.once("SIGINT", shutdown);
  processPort.once("SIGTERM", shutdown);
  return () => {
    processPort.removeListener("SIGINT", shutdown);
    processPort.removeListener("SIGTERM", shutdown);
  };
}
