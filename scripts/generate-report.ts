import { pathToFileURL } from "node:url";

import { createRuntimePool } from "../src/infrastructure/database/pool.js";
import { loadRuntimeConfig } from "../src/infrastructure/config/load-config.js";
import { verifyRuntimeDatabase } from "../src/infrastructure/database/migrations.js";
import { readPaperPerformanceReport } from "../src/workers/health-worker.js";
import type { WalletAddress } from "../src/domain/shared/types.js";

export async function generatePaperReport(environment: NodeJS.ProcessEnv): Promise<string> {
  const config = loadRuntimeConfig(environment);
  if (config.mode !== "paper" || config.paper === null)
    throw new Error("Paper performance reporting requires paper mode");
  const database = createRuntimePool({
    connectionString: config.databaseUrl,
    production: config.environment === "production",
  });
  try {
    const readiness = await verifyRuntimeDatabase(database, "paper");
    const performance = await readPaperPerformanceReport(
      database,
      config.paper.walletAddress as WalletAddress,
    );
    return JSON.stringify({ mode: "paper", readiness, performance }, null, 2);
  } finally {
    await database.end();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  generatePaperReport(process.env)
    .then((report) => process.stdout.write(`${report}\n`))
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Unknown report failure"}\n`,
      );
      process.exitCode = 1;
    });
}
