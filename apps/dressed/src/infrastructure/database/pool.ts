import pg from "pg";

export function createDatabasePool(input: { readonly connectionString: string; readonly production: boolean }) {
  const hostname = new URL(input.connectionString).hostname;
  const loopback = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  return new pg.Pool({
    connectionString: input.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "dressed",
    ssl: input.production && !loopback ? { rejectUnauthorized: true } : undefined,
  });
}
