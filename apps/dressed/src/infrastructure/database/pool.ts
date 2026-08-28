import pg from "pg";

export function createDatabasePool(input: { readonly connectionString: string; readonly production: boolean }) {
  return new pg.Pool({
    connectionString: input.connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "dressed",
    ssl: input.production ? { rejectUnauthorized: true } : undefined,
  });
}

