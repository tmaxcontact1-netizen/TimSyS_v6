import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Pool } from "pg";

import { createRuntimePool } from "../infrastructure/database/pool.js";
import { loadRuntimeConfig, type RuntimeConfig } from "../infrastructure/config/load-config.js";
import {
  composePaperTradingRuntime,
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
      managedLocal: config.managedDatabase,
      maximumConnections: config.managedDatabase ? 6 : 10,
    }),
  compose: (input: {
    readonly config: RuntimeConfig;
    readonly database: Pool;
    readonly signal: AbortSignal;
  }) =>
    input.config.mode === "paper"
      ? composePaperTradingRuntime(input)
      : composeProductionPositionRuntime(input),
  run: runProductionProcess,
});

export function persistHandledWorkerIncident(
  error: unknown,
  environment: NodeJS.ProcessEnv,
  occurredAt = new Date(),
) {
  const message = error instanceof Error ? error.message : "Unknown production worker failure";
  const incident = Object.freeze({
    schemaVersion: 1,
    level: "fatal",
    kind: "handled_top_level_exception",
    occurredAt: occurredAt.toISOString(),
    pid: process.pid,
    message,
    stack: error instanceof Error ? (error.stack ?? null) : null,
  });
  const logRoot = environment.TIMSYS_CHILD_LOG_ROOT;
  if (logRoot) {
    mkdirSync(logRoot, { recursive: true });
    writeFileSync(
      join(logRoot, `worker-incident-${incident.occurredAt.replaceAll(":", "-")}.json`),
      `${JSON.stringify(incident, null, 2)}\n`,
      { flag: "wx" },
    );
  }
  return incident;
}

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
    return await factories.run({
      config,
      database,
      supervisor: runtime.supervisor,
      ...(runtime.observationScheduler
        ? { observationScheduler: runtime.observationScheduler }
        : {}),
    });
  } finally {
    removeSignals();
    if (!processOwnsPool) await database.end();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  startProductionWorker(process.env).catch((error: unknown) => {
    let incident;
    try {
      incident = persistHandledWorkerIncident(error, process.env);
    } catch (captureError) {
      incident = Object.freeze({
        schemaVersion: 1,
        level: "fatal",
        kind: "handled_top_level_exception",
        occurredAt: new Date().toISOString(),
        pid: process.pid,
        message: error instanceof Error ? error.message : "Unknown production worker failure",
        stack: error instanceof Error ? (error.stack ?? null) : null,
      });
      process.stderr.write(
        `${JSON.stringify({ level: "error", message: "Failed to persist worker incident", cause: captureError instanceof Error ? captureError.message : "unknown" })}\n`,
      );
    }
    process.stderr.write(`${JSON.stringify(incident)}\n`);
    process.exitCode = 1;
  });
}
