import { describe, expect, it, vi } from "vitest";
import pg from "pg";
import { createDatabasePool } from "../../src/infrastructure/database/pool.js";

describe("Dress'Ed database transport", () => {
  it("uses the launcher's loopback PostgreSQL without TLS", () => {
    const constructor = vi.spyOn(pg, "Pool");
    createDatabasePool({ connectionString: "postgresql://app:secret@127.0.0.1:5432/memecoined", production: true });
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ ssl: undefined }));
    constructor.mockRestore();
  });

  it("requires verified TLS for a remote production database", () => {
    const constructor = vi.spyOn(pg, "Pool");
    createDatabasePool({ connectionString: "postgresql://app:secret@database.example.test:5432/dressed", production: true });
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ ssl: { rejectUnauthorized: true } }));
    constructor.mockRestore();
  });
});
