import { Pool, type PoolConfig } from "pg";

const retryableDatabaseError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated") || message.includes("connection refused") ||
    message.includes("the database system is starting up") || message.includes("57p03");
};

export async function retryDatabaseOperation<T>(operation: () => Promise<T>, options: {
  readonly attempts?: number; readonly initialDelayMs?: number; readonly maximumWaitMs?: number;
} = {}): Promise<T> {
  const attempts = options.attempts ?? 5;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maximumWaitMs = options.maximumWaitMs ?? 15_000;
  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (!retryableDatabaseError(error) || attempt === attempts - 1) throw error;
      const delay = Math.min(initialDelayMs * 2 ** attempt, 4_000);
      if (Date.now() - started + delay > maximumWaitMs) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export interface RuntimePoolOptions {
  readonly connectionString: string;
  readonly production: boolean;
  readonly managedLocal?: boolean;
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
  if (options.managedLocal) {
    const hostname = new URL(options.connectionString).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1")
      throw new Error("Managed local database must use a loopback host");
  }
  return Object.freeze({
    connectionString: options.connectionString,
    max: maximum,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    allowExitOnIdle: false,
    ...(options.production && !options.managedLocal
      ? { ssl: { rejectUnauthorized: true } }
      : { ssl: false }),
  });
}

export function createRuntimePool(options: RuntimePoolOptions): Pool {
  const pool = new Pool(runtimePoolConfig(options));
  // Pool acquisition can briefly fail while managed PostgreSQL restarts or while
  // a burst exhausts the small local pool. Retry acquisition, never SQL errors.
  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  const originalConnect = pool.connect.bind(pool) as (...args: unknown[]) => Promise<unknown>;
  (pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query =
    (...args: unknown[]) => retryDatabaseOperation(() => originalQuery(...args));
  (pool as unknown as { connect: (...args: unknown[]) => Promise<unknown> }).connect =
    (...args: unknown[]) => retryDatabaseOperation(() => originalConnect(...args));
  // pg emits idle-client failures on the Pool itself. Without a listener, a managed
  // PostgreSQL restart terminates the entire worker/dashboard process instead of
  // allowing the pool to reconnect on the next request.
  pool.on("error", (error) => {
    process.stderr.write(
      `${JSON.stringify({ level: "error", source: "database-pool", message: error.message })}\n`,
    );
  });
  return pool;
}
