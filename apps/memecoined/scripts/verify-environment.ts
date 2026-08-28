import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { pathToFileURL } from "node:url";

import { createRuntimePool } from "../src/infrastructure/database/pool.js";
import { verifyRuntimeDatabase } from "../src/infrastructure/database/migrations.js";
import { loadRuntimeConfig } from "../src/infrastructure/config/load-config.js";
import {
  loadManagedApplicationManifest,
  verifyInstallAssets,
} from "../src/infrastructure/runtime/managed-application.js";
import { BoundedJsonHttpTransport } from "../src/infrastructure/providers/http-json.js";
import {
  verifyProviderReadiness,
  type ProviderReadinessReport,
} from "../src/infrastructure/runtime/provider-readiness.js";

export interface EnvironmentReadinessReport {
  readonly mode: string;
  readonly installation: "ready";
  readonly database: "ready";
  readonly providers: ProviderReadinessReport | "not_probed";
}

export async function verifyEnvironment(
  environment: NodeJS.ProcessEnv,
  probeProviders = false,
): Promise<EnvironmentReadinessReport> {
  const config = loadRuntimeConfig(environment);
  const manifest = await loadManagedApplicationManifest(environment);
  await verifyInstallAssets(environment, manifest);
  await access(config.configDirectory, constants.R_OK);
  if (config.execution !== null) await access(config.execution.walletSecretFile, constants.R_OK);

  const database = createRuntimePool({
    connectionString: config.databaseUrl,
    production: config.environment === "production",
    managedLocal: config.managedDatabase,
  });
  try {
    await verifyRuntimeDatabase(database, config.mode, config.mode === "paper");
  } finally {
    await database.end();
  }
  let providers: ProviderReadinessReport | "not_probed" = "not_probed";
  if (probeProviders) {
    if (config.solana === null) throw new Error("Provider probing requires a live-data mode");
    const origins = new Set([
      new URL(config.solana.primaryRpcUrl).origin,
      new URL(config.solana.fallbackRpcUrl).origin,
    ]);
    providers = await verifyProviderReadiness(
      config.solana,
      new BoundedJsonHttpTransport({
        allowedOrigins: origins,
        timeoutMs: 10_000,
        maximumResponseBytes: 64_000,
      }),
    );
  }
  return Object.freeze({
    mode: config.mode,
    installation: "ready",
    database: "ready",
    providers,
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyEnvironment(process.env, process.argv.includes("--probe-providers"))
    .then((report) => {
      process.stdout.write(`${JSON.stringify({ event: "environment_verified", ...report })}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${JSON.stringify({ event: "environment_verification_failed", message: error instanceof Error ? error.message : "Unknown failure" })}\n`,
      );
      process.exitCode = 1;
    });
}
