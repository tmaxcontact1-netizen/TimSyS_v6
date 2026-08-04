import { Pool, type PoolConfig } from "pg";

export interface RuntimePoolOptions {
  readonly connectionString: string;
  readonly production: boolean;
  readonly maximumConnections?: number;
  readonly connectionTimeoutMs?: number;
  readonly idleTimeoutMs?: number;
}

export function runtimePoolConfig(options: RuntimePoolOptions): Readonly<PoolConfig> {
  const maximum = options.maximumConnections ?? 10;
  const connectionTimeoutMillis = options.connectionTimeoutMs ?? 5_000;
  const idleTimeoutMillis = options.idleTimeoutMs ?? 30_000;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 50)
    throw new RangeError("Database pool size must be between 1 and 50");
  if (!Number.isSafeInteger(connectionTimeoutMillis) || connectionTimeoutMillis < 100)
    throw new RangeError("Database connection timeout must be at least 100ms");
  if (!Number.isSafeInteger(idleTimeoutMillis) || idleTimeoutMillis < 1_000)
    throw new RangeError("Database idle timeout must be at least 1000ms");
  return Object.freeze({
    connectionString: options.connectionString,
    max: maximum,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    allowExitOnIdle: false,
    ...(options.production ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}

export function createRuntimePool(options: RuntimePoolOptions): Pool {
  return new Pool(runtimePoolConfig(options));
}
