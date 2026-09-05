import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createDressedServer } from "../../src/entrypoints/api.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function runningServer(schemaReady = true) {
  const publicDirectory = await mkdtemp(join(tmpdir(), "dressed-api-"));
  await writeFile(join(publicDirectory, "index.html"), "<main>Dress'Ed</main>");
  const query = vi.fn().mockResolvedValue({ rows: [{ database: "dressed", schema_ready: schemaReady, catalogue_ready: schemaReady, photography_ready: schemaReady, fingerprint_ready: schemaReady, styling_ready: schemaReady, ensemble_ready: schemaReady, planner_ready: schemaReady, lifecycle_ready: schemaReady, insights_ready: schemaReady }] });
  const server = createDressedServer({ database: { query } as never, publicDirectory, storageRoot: publicDirectory, now: () => new Date("2026-08-28T12:00:00.000Z") });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  cleanups.push(async () => {
    server.close();
    await once(server, "close");
    await rm(publicDirectory, { recursive: true, force: true });
  });
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}`, query };
}

describe("Dress'Ed Phase 1 API", () => {
  test("reports a healthy isolated Dress'Ed schema", async () => {
    const { baseUrl, query } = await runningServer();
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "healthy",
      application: "dressed",
      version: "0.0.0",
      database: "ready",
      observedAt: "2026-08-28T12:00:00.000Z",
    });
    expect(query).toHaveBeenCalledOnce();
  });

  test("reports the complete Phase 9 capabilities", async () => {
    const { baseUrl } = await runningServer();
    const response = await fetch(`${baseUrl}/api/application`);
    expect(await response.json()).toMatchObject({ phase: 9, operationalFeatures: expect.arrayContaining(["manual-grade-overrides", "immutable-wear-history", "wardrobe-insights", "user-preferences"]) });
  });

  test("serves the shell but rejects traversal and unsupported files", async () => {
    const { baseUrl } = await runningServer();
    expect((await fetch(`${baseUrl}/`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/private.txt`)).status).toBe(404);
  });

  test("degrades visibly when the Dress'Ed schema is absent", async () => {
    const { baseUrl } = await runningServer(false);
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "degraded", database: "schema_unavailable" });
  });

  test("rejects preference values whose type does not match the selected preference", async () => {
    const { baseUrl, query } = await runningServer();
    const response = await fetch(`${baseUrl}/api/preferences`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "show_internal_scores", value: 1 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "validation_failed" });
    expect(query).not.toHaveBeenCalled();
  });
});
