import { once } from "node:events";
import { request, type IncomingHttpHeaders } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { createPaperDashboardServer } from "../../src/entrypoints/dashboard.js";

const servers: ReturnType<typeof createPaperDashboardServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function get(port: number, path: string, method = "GET") {
  return await new Promise<{ status: number; body: string; headers: IncomingHttpHeaders }>(
    (resolve, reject) => {
      const call = request({ hostname: "127.0.0.1", port, path, method }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body, headers: response.headers }),
        );
      });
      call.on("error", reject);
      call.end();
    },
  );
}

describe("paper dashboard", () => {
  it("serves a read-only durable snapshot with security headers", async () => {
    const row = {
      initial_cash_raw: "10000000000",
      cash_raw: "9000000000",
      open_cost_raw: "800000000",
      realized_pnl_raw: "100000000",
      fills: "3",
      open_positions: "1",
      pending_entries: "2",
      pending_positions: "1",
      worker_errors: "0",
    };
    const database = { query: async () => ({ rows: [row] }), end: async () => undefined };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "paper-wallet" as never,
      publicDirectory: "frontend",
      now: () => new Date("2026-08-10T12:00:00.000Z"),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const response = await get(address.port, "/api/paper/snapshot");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.body)).toMatchObject({
      mode: "paper",
      observedAt: "2026-08-10T12:00:00.000Z",
      performance: { cashRaw: "9000000000", healthy: true },
    });
    const page = await get(address.port, "/");
    expect(page.status).toBe(200);
    expect(page.body).toContain("Paper desk");
    expect(page.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect((await get(address.port, "/api/paper/snapshot", "POST")).status).toBe(405);
  });

  it("fails closed when the durable snapshot is unavailable", async () => {
    const database = {
      query: async () => {
        throw new Error("offline");
      },
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "paper-wallet" as never,
      publicDirectory: "frontend",
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const response = await get(address.port, "/api/paper/snapshot");
    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: "paper_snapshot_unavailable" });
  });
});
