import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { resolveApplicationRoot } from "./application-root.js";

const processSchema = z.object({
  command: z.literal("node"),
  arguments: z.tuple([z.string().startsWith("dist/")]),
});

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.literal("memecoined"),
  name: z.literal("Memecoined"),
  kind: z.literal("supervised-child"),
  applicationRootEnvironment: z.literal("MEMECOINED_APP_ROOT"),
  workingDirectory: z.literal("."),
  processes: z.object({
    worker: processSchema,
    dashboard: processSchema.extend({
      health: z.object({
        url: z.literal("http://127.0.0.1:${PAPER_DASHBOARD_PORT}/api/health"),
        expectedStatus: z.literal(200),
      }),
    }),
  }),
  shutdown: z.object({
    signal: z.literal("SIGTERM"),
    timeoutMilliseconds: z.number().int().min(1_000).max(30_000),
  }),
  ownership: z.object({
    runtime: z.literal("memecoined"),
    database: z.literal("memecoined"),
    configuration: z.literal("memecoined"),
  }),
});

export type ManagedApplicationManifest = z.infer<typeof manifestSchema>;

export async function loadManagedApplicationManifest(
  environment: NodeJS.ProcessEnv,
): Promise<ManagedApplicationManifest> {
  const root = resolveApplicationRoot(environment);
  const path = join(root, "timsys.app.json");
  let input: unknown;
  try {
    input = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read managed-application manifest at ${path}`, { cause: error });
  }
  const parsed = manifestSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(`Invalid managed-application manifest: ${z.prettifyError(parsed.error)}`);
  return Object.freeze(parsed.data);
}

export async function verifyInstallAssets(
  environment: NodeJS.ProcessEnv,
  manifest: ManagedApplicationManifest,
): Promise<void> {
  const root = resolveApplicationRoot(environment);
  const paths = [
    manifest.processes.worker.arguments[0],
    manifest.processes.dashboard.arguments[0],
    "frontend/index.html",
    "migrations",
  ];
  await Promise.all(
    paths.map(async (relativePath) => {
      try {
        await access(join(root, relativePath), constants.R_OK);
      } catch (error) {
        throw new Error(`Required Memecoined asset is unavailable: ${relativePath}`, {
          cause: error,
        });
      }
    }),
  );
}
