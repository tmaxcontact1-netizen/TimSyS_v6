import { pathToFileURL } from "node:url";

import type { Pool } from "pg";

import { createRuntimePool } from "../infrastructure/database/pool.js";
import { loadRuntimeConfig, type RuntimeConfig } from "../infrastructure/config/load-config.js";
import {
  composeProductionPositionRuntime,
  type PositionRuntimeComposition,
} from "./composition.js";
import { installShutdownSignals, runProductionProcess } from "./main.js";

export interface ProductionWorkerFactories {
  readonly createPool: (config: RuntimeConfig) => Pool;
  readonly compose: (input: {
    readonly config: RuntimeConfig;
    readonly database: Pool;
    readonly signal: AbortSignal;
  }) => PositionRuntimeComposition;
  readonly run: typeof runProductionProcess;
}

const productionFactories: ProductionWorkerFactories = Object.freeze({
  createPool: (config: RuntimeConfig) =>
    createRuntimePool({
      connectionString: config.databaseUrl,
      production: config.environment === "production",
    }),
  compose: composeProductionPositionRuntime,
  run: runProductionProcess,
});

/** Owns the complete worker process lifecycle and closes pools even before process startup. */
export async function startProductionWorker(
  environment: NodeJS.ProcessEnv,
  factories: ProductionWorkerFactories = productionFactories,
) {
  const config = loadRuntimeConfig(environment);
  const controller = new AbortController();
  const removeSignals = installShutdownSignals(controller);
  const database = factories.createPool(config);
  let processOwnsPool = false;
  try {
    const runtime = factories.compose({ config, database, signal: controller.signal });
    processOwnsPool = true;
    return await factories.run({ config, database, supervisor: runtime.supervisor });
  } finally {
    removeSignals();
    if (!processOwnsPool) await database.end();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  startProductionWorker(process.env).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown production worker failure";
    process.stderr.write(`${JSON.stringify({ level: "fatal", message })}\n`);
    process.exitCode = 1;
  });
}
