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
      "study-designer",
      "corpus-manager",
      "entity-modelling",
      "source-archive",
      "source-extraction",
      "evidence-capture",
      "cross-source-analysis",
      "findings",
      "reporting",
      "research-lifecycle",
      "audit-history",
      "evidence-search",
      "source-discovery",
      "acquisition-queue",
      "browser-rendering",
      "pdf-ocr",
      "analysis-planner",
      "deterministic-analysis",
      "human-analysis-review",
      "background-analysis-jobs",
      "guided-analysis-setup",
      "analysis-templates",
      "analysis-result-export",
      "research-insights",
      "batch-source-intake",
      "document-upload",
      "interactive-content-expansion",
    ]);
    const connected=await fetch(`${base}/api/ai/connection`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({protocol:"openai-chat",model:"local-model",baseUrl:"http://127.0.0.1:11434"})});
    expect(await connected.json()).toMatchObject({configured:true,protocol:"openai-chat",persistence:"memory-only"});
    expect(await (await fetch(`${base}/api/capabilities`)).json()).toMatchObject({aiAnalysis:{available:true,provider:"openai-chat",model:"local-model"}});
    expect((await fetch(`${base}/api/ai/connection`,{method:"DELETE"})).status).toBe(200);
  });
});
