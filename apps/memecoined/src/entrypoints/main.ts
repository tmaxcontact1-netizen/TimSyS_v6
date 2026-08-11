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

export interface ProductionProcessDependencies {
  readonly config: RuntimeConfig;
  readonly database: Pick<Pool, "query" | "end">;
  readonly supervisor: PositionJobSupervisorDependencies;
}
export interface ProductionProcessResult {
  readonly database: DatabaseReadiness;
  readonly supervisor: PositionJobSupervisorResult;
}

/** Validates durable state before recovery and always drains the database pool on exit. */
export async function runProductionProcess(
  dependencies: ProductionProcessDependencies,
): Promise<ProductionProcessResult> {
  try {
    const database = await verifyRuntimeDatabase(dependencies.database, dependencies.config.mode);
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
    return Object.freeze({
      database,
      supervisor: await runPositionJobSupervisor(dependencies.supervisor),
    });
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
