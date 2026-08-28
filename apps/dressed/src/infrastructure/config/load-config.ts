import { isAbsolute } from "node:path";
import { z } from "zod";

const schema = z.object({
  DRESSED_ENV: z.enum(["development", "test", "production"]),
  DRESSED_INSTANCE_ID: z.string().trim().min(1),
  DRESSED_LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
  DRESSED_CONFIG_DIR: z.string().refine(isAbsolute, "must be absolute"),
  DRESSED_STORAGE_ROOT: z.string().refine(isAbsolute, "must be absolute"),
  DRESSED_DATABASE_URL: z.string().url().refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "must be a PostgreSQL URI",
  ),
  DRESSED_CV_BASE_URL: z.string().url().refine(
    (value) => new URL(value).hostname === "127.0.0.1" || new URL(value).hostname === "localhost",
    "CV service must be local",
  ),
  DRESSED_CV_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(10_000),
  DRESSED_PORT: z.coerce.number().int().min(1).max(65_535).default(8090),
});

export type DressedConfig = Readonly<{
  environment: "development" | "test" | "production";
  instanceId: string;
  logLevel: "debug" | "info" | "warn" | "error" | "fatal";
  configDirectory: string;
  storageRoot: string;
  databaseUrl: string;
  cvBaseUrl: string;
  cvTimeoutMs: number;
  port: number;
}>;

export function loadConfig(environment: NodeJS.ProcessEnv): DressedConfig {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new Error(`Invalid Dress'Ed configuration: ${z.prettifyError(parsed.error)}`);
  const value = parsed.data;
  return Object.freeze({
    environment: value.DRESSED_ENV,
    instanceId: value.DRESSED_INSTANCE_ID,
    logLevel: value.DRESSED_LOG_LEVEL,
    configDirectory: value.DRESSED_CONFIG_DIR,
    storageRoot: value.DRESSED_STORAGE_ROOT,
    databaseUrl: value.DRESSED_DATABASE_URL,
    cvBaseUrl: value.DRESSED_CV_BASE_URL.replace(/\/$/, ""),
    cvTimeoutMs: value.DRESSED_CV_TIMEOUT_MS,
    port: value.DRESSED_PORT,
  });
}
