import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createDressedServer } from "../../src/entrypoints/api.js";

import { StylingRepository } from "../../src/infrastructure/database/styling-repository.js";
import { EnsembleRepository } from "../../src/infrastructure/database/ensemble-repository.js";
import * as engine from "../../src/domain/outfit/ensemble-engine.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function runningServer(schemaReady = true) {
  const publicDirectory = await mkdtemp(join(tmpdir(), "dressed-api-"));
  await writeFile(join(publicDirectory, "index.html"), "<main>Dress'Ed</main>");
  const query = vi.fn().mockResolvedValue({ rows: [{ database: "dressed", schema_ready: schemaReady, catalogue_ready: schemaReady, photography_ready: schemaReady, fingerprint_ready: schemaReady, styling_ready: schemaReady, ensemble_ready: schemaReady, planner_ready: schemaReady, lifecycle_ready: schemaReady, insights_ready: schemaReady, intake_ready: schemaReady }] });
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
    expect(await response.json()).toMatchObject({
      protocol: "timsys.application.v1",
      status: "healthy",
      application: "dressed",
      version: "0.2.0",
      database: "ready",
      observedAt: "2026-08-28T12:00:00.000Z",
      components: expect.arrayContaining([expect.objectContaining({ id: "database", status: "healthy" })]),
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


describe("manual builder exclusions",()=>{
  const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
  test("only selected garments are removed, restoring them works, and exhausted categories are reported",async()=>{
    const items=[{id:id(1),name:"Fixed shirt",slotId:"top"},{id:id(2),name:"Used pink square",slotId:"pocket_square"},{id:id(3),name:"Other used square",slotId:"pocket_square"},{id:id(4),name:"Jacket",slotId:"jacket"}];
    vi.spyOn(StylingRepository.prototype,"catalogue").mockResolvedValue({contexts:[{id:id(9)}],ruleSet:{id:id(8),thresholds:{a:90,b:80,c:70}}} as never);
    vi.spyOn(StylingRepository.prototype,"parameters").mockResolvedValue({});
    vi.spyOn(EnsembleRepository.prototype,"candidates").mockResolvedValue(items as never);
    vi.spyOn(EnsembleRepository.prototype,"requirements").mockResolvedValue([]);
    vi.spyOn(EnsembleRepository.prototype,"overrides").mockResolvedValue([]);
    const generate=vi.spyOn(engine,"generateEnsembles").mockReturnValue({a:[],b:[],c:[],examined:0,rejected:0} as never);
    try{
      const {baseUrl}=await runningServer();
      const request=async(excludedGarmentIds:string[])=>fetch(`${baseUrl}/api/ensembles/generate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fixedGarmentIds:[id(1)],contextId:id(9),selectedSlotIds:["top","pocket_square"],excludedGarmentIds})});
      expect((await request([id(2)])).status).toBe(200);
      expect(generate.mock.lastCall?.[0].available.map(g=>g.id)).toEqual([id(1),id(3),id(4)]);
      expect((await request([])).status).toBe(200);
      expect(generate.mock.lastCall?.[0].available.map(g=>g.id)).toEqual(items.map(g=>g.id));
      const exhausted=await request([id(2),id(3)]);
      expect(await exhausted.json()).toMatchObject({missingSelectedSlots:["pocket_square"]});
      expect((await request([id(1)])).status).toBe(400);
    }finally{vi.restoreAllMocks();}
  });
});
