import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { createRuntimePool } from "../src/infrastructure/database/pool.js";
import { verifyRuntimeDatabase } from "../src/infrastructure/database/migrations.js";
import { loadRuntimeConfig } from "../src/infrastructure/config/load-config.js";
import {
  loadManagedApplicationManifest,
  verifyInstallAssets,
} from "../src/infrastructure/runtime/managed-application.js";

export async function verifyEnvironment(environment: NodeJS.ProcessEnv): Promise<void> {
  const config = loadRuntimeConfig(environment);
  const manifest = await loadManagedApplicationManifest(environment);
  await verifyInstallAssets(environment, manifest);
  await access(config.configDirectory, constants.R_OK);
  if (config.execution !== null) await access(config.execution.walletSecretFile, constants.R_OK);

  const database = createRuntimePool({
    connectionString: config.databaseUrl,
    production: config.environment === "production",
  });
  try {
    await verifyRuntimeDatabase(database, config.mode, config.mode === "paper");
  } finally {
    await database.end();
  }
}

if (process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href) {
  verifyEnvironment(process.env)
    .then(() => {
      process.stdout.write(
        `${JSON.stringify({ event: "environment_verified", mode: process.env.MEMECOINED_MODE })}\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${JSON.stringify({ event: "environment_verification_failed", message: error instanceof Error ? error.message : "Unknown failure" })}\n`,
      );
      process.exitCode = 1;
    });
}
