import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { createResearchServer } from "../src/entrypoints/api.js";
const servers: ReturnType<typeof createResearchServer>[] = [];
afterEach(() =>
  Promise.all(
    servers.map((s) => new Promise<void>((done) => s.close(() => done()))),
  ),
);
describe("Research'Ed application contract", () => {
  it("reports canonical health and functional boundaries", async () => {
    const database = {
      query: async (sql: string) => ({
        rows: sql.includes("to_regclass")
          ? [{ ready: true }]
          : [
              {
                studies: 0,
                sources: 0,
                snapshots: 0,
                extractions: 0,
                evidence: 0,
                findings: 0,
                reports: 0,
                entities: 0,
              },
            ],
        rowCount: 1,
      }),
    } as any;
    const server = createResearchServer({
      database,
      publicDirectory: "missing",
      now: () => new Date("2026-09-06T00:00:00.000Z"),
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health).toMatchObject({
      protocol: "timsys.application.v1",
      application: "researched",
      status: "healthy",
    });
    const application = await (await fetch(`${base}/api/application`)).json();
    expect(application.functions).toEqual([
      "programme-document-intake",
      "programme-link-review",
      "rendered-programme-capture",
      "interactive-content-expansion",
      "programme-structure-extraction",
      "evidence-backed-programme-export",
    ]);
    expect(await (await fetch(`${base}/api/capabilities`)).json()).toMatchObject({browserRendering:{available:expect.any(Boolean)}});
    expect((await fetch(`${base}/api/analysis-types`)).status).toBe(404);
  });
});
