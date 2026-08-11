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

async function get(
  port: number,
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
  body?: string,
) {
  const requestHeaders =
    body === undefined
      ? headers
      : { ...headers, "content-length": String(Buffer.byteLength(body)) };
  return await new Promise<{ status: number; body: string; headers: IncomingHttpHeaders }>(
    (resolve, reject) => {
      const call = request(
        { hostname: "127.0.0.1", port, path, method, headers: requestHeaders },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => (body += chunk));
          response.on("end", () =>
            resolve({ status: response.statusCode ?? 0, body, headers: response.headers }),
          );
        },
      );
      call.on("error", reject);
      call.end(body);
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
    expect(page.body).toContain("Portfolio allocation");
    expect(page.body).toContain("Token watchlist");
    expect(page.body).toContain('id="watchlist-select"');
    expect(page.body).toContain('id="watchlist-create"');
    expect(page.body).toContain('id="watchlist-rename"');
    expect(page.body).toContain('id="watchlist-delete"');
    expect(page.body).toContain('id="watchlist-import"');
    expect(page.body).toContain('id="configuration-form"');
    expect(page.body).toContain('id="configuration-select"');
    expect(page.body).toContain('id="configuration-delete"');
    expect(page.body).toContain('id="pending-entry-rows"');
    expect(page.body).toContain('id="paper-control-message"');
    expect(page.body).toContain("Only available, unleased paper entries can be cancelled.");
    expect(page.body).toContain("Draft storage only");
    expect(page.body).toContain('type="password"');
    expect(page.body).toContain('data-sort="cost_raw"');
    expect(page.body).toContain('id="preferences-dialog"');
    expect(page.body).toContain('name="density" value="compact"');
    expect(page.body).toContain('id="sidebar-collapse"');
    expect(page.body).toContain('id="panel-preferences"');
    expect(page.body).toContain('id="theme-preference"');
    expect(page.body).toContain('id="high-contrast"');
    expect(page.body).toContain('id="reduce-motion"');
    expect(page.body).toContain('id="preferences-export"');
    expect(page.body).toContain('id="preferences-import"');
    expect(page.body).toContain('data-dashboard-panel="overview"');
    expect(page.body).toContain('data-dashboard-panel="trading"');
    expect(page.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect((await get(address.port, "/api/paper/snapshot", "POST")).status).toBe(405);
    const health = await get(address.port, "/api/health");
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ status: "ok", mode: "paper" });
    expect((await get(address.port, "/api/health", "POST")).status).toBe(405);
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

  it("serves bounded detail data without exposing a mutation route", async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            positions: [],
            pending_entries: [],
            fills: [{ side: "buy" }],
            performance: [],
            events: [],
          },
        ],
      }),
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
      now: () => new Date("2026-08-10T12:00:00.000Z"),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const response = await get(address.port, "/api/paper/details");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      mode: "paper",
      details: { fills: [{ side: "buy" }] },
    });
    expect((await get(address.port, "/api/paper/details", "DELETE")).status).toBe(405);
  });

  it("validates token addresses before serving a read-only lifecycle", async () => {
    let queries = 0;
    const database = {
      query: async () => {
        queries += 1;
        return {
          rows: [
            {
              summary: { token_mint: "So11111111111111111111111111111111111111112" },
              lots: [],
              fills: [],
              performance: [],
              events: [],
            },
          ],
        };
      },
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    expect((await get(address.port, "/api/paper/token?mint=invalid")).status).toBe(400);
    expect(queries).toBe(0);
    const response = await get(
      address.port,
      "/api/paper/token?mint=So11111111111111111111111111111111111111112",
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      mode: "paper",
      token: { summary: { token_mint: "So11111111111111111111111111111111111111112" } },
    });
    expect(queries).toBe(1);
    expect(
      (
        await get(
          address.port,
          "/api/paper/token?mint=So11111111111111111111111111111111111111112",
          "POST",
        )
      ).status,
    ).toBe(405);
  });

  it("serves fixed-range book-equity history and rejects arbitrary intervals", async () => {
    let queries = 0;
    const database = {
      query: async () => {
        queries += 1;
        return { rows: [] };
      },
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const valid = await get(address.port, "/api/paper/performance?range=30d");
    expect(valid.status).toBe(200);
    expect(JSON.parse(valid.body)).toMatchObject({
      range: "30d",
      basis: "realized_book_equity",
      points: [],
    });
    expect((await get(address.port, "/api/paper/performance?range=1%20year")).status).toBe(400);
    expect(queries).toBe(1);
  });

  it("serves bounded worker alerts through a GET-only route", async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            token_mint: "mint",
            last_error: "quote failed",
            available_at: "2026-08-10T12:00:00Z",
            last_monitored_at: null,
          },
        ],
      }),
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const response = await get(address.port, "/api/paper/alerts");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      mode: "paper",
      alerts: [{ tokenMint: "mint", message: "quote failed" }],
    });
    expect((await get(address.port, "/api/paper/alerts", "DELETE")).status).toBe(405);
  });

  it("authenticates watchlist mutations and enforces optimistic versions", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const database = {
      query: async (sql: string) => {
        if (sql.includes("INSERT INTO dashboard_watchlists"))
          return {
            rows: [
              {
                id,
                name: "Momentum",
                version: 1,
                created_at: "2026-08-10T12:00:00Z",
                updated_at: "2026-08-10T12:00:00Z",
                tokens: [],
              },
            ],
          };
        return { rows: [] };
      },
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
      mutationToken: "a".repeat(32),
      now: () => new Date("2026-08-10T12:00:00.000Z"),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const payload = JSON.stringify({ name: "Momentum" });
    expect((await get(address.port, "/api/watchlists", "POST")).status).toBe(401);
    const headers = {
      authorization: `Bearer ${"a".repeat(32)}`,
      origin: `http://127.0.0.1:${address.port}`,
      host: `127.0.0.1:${address.port}`,
      "content-type": "application/json",
    };
    const response = await get(address.port, "/api/watchlists", "POST", headers, payload);
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      watchlist: { id, name: "Momentum", version: 1, tokens: [] },
    });
  });

  it("requires destructive confirmation for watchlist deletion", async () => {
    let queries = 0;
    const server = createPaperDashboardServer({
      database: {
        query: async () => {
          queries += 1;
          return { rows: [] };
        },
        end: async () => undefined,
      } as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
      mutationToken: "b".repeat(32),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const headers = {
      authorization: `Bearer ${"b".repeat(32)}`,
      origin: `http://127.0.0.1:${address.port}`,
      host: `127.0.0.1:${address.port}`,
      "content-type": "application/json",
    };
    const response = await get(
      address.port,
      "/api/watchlists/123e4567-e89b-42d3-a456-426614174000",
      "DELETE",
      headers,
      JSON.stringify({ expectedVersion: 1 }),
    );
    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: "invalid_confirmation" });
    expect(queries).toBe(0);
  });

  it("authenticates and validates trading-configuration creation", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174001";
    let queries = 0;
    const database = {
      query: async () => {
        queries += 1;
        return {
          rows: [
            {
              id,
              name: "Conservative paper",
              strategy_version_id: "strategy-v1.0.0",
              maximum_concurrent_positions: 3,
              risk_per_trade_bps: 50,
              maximum_position_equity_bps: 500,
              maximum_open_exposure_bps: 1000,
              minimum_uncommitted_equity_bps: 5000,
              entry_slippage_bps: 150,
              version: 1,
              created_at: "2026-08-10T12:00:00Z",
              updated_at: "2026-08-10T12:00:00Z",
            },
          ],
        };
      },
      end: async () => undefined,
    };
    const server = createPaperDashboardServer({
      database: database as never,
      wallet: "wallet" as never,
      publicDirectory: "frontend",
      mutationToken: "c".repeat(32),
      now: () => new Date("2026-08-10T12:00:00.000Z"),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const headers = {
      authorization: `Bearer ${"c".repeat(32)}`,
      origin: `http://127.0.0.1:${address.port}`,
      host: `127.0.0.1:${address.port}`,
      "content-type": "application/json",
    };
    const body = JSON.stringify({
      name: "Conservative paper",
      strategyVersionId: "strategy-v1.0.0",
      maximumConcurrentPositions: 3,
      riskPerTradeBps: 50,
      maximumPositionEquityBps: 500,
      maximumOpenExposureBps: 1000,
      minimumUncommittedEquityBps: 5000,
      entrySlippageBps: 150,
    });
    expect((await get(address.port, "/api/trading-configurations", "POST")).status).toBe(401);
    const response = await get(address.port, "/api/trading-configurations", "POST", headers, body);
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      configuration: { id, name: "Conservative paper", version: 1 },
    });
    const invalid = JSON.stringify({ ...JSON.parse(body), entrySlippageBps: 151 });
    expect(
      (await get(address.port, "/api/trading-configurations", "POST", headers, invalid)).status,
    ).toBe(400);
    expect(queries).toBe(1);
  });

  it("guards paper entry cancellation with authentication, confirmation, and version", async () => {
    const signalId = "123e4567-e89b-42d3-a456-426614174010";
    let queries = 0;
    const server = createPaperDashboardServer({
      database: {
        query: async () => {
          queries += 1;
          return { rows: [{ signal_id: signalId, version: 4 }] };
        },
        end: async () => undefined,
      } as never,
      wallet: "paper-wallet" as never,
      publicDirectory: "frontend",
      mutationToken: "d".repeat(32),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const path = `/api/paper/orders/${signalId}/cancel`;
    expect((await get(address.port, path, "POST")).status).toBe(401);
    const headers = {
      authorization: `Bearer ${"d".repeat(32)}`,
      origin: `http://127.0.0.1:${address.port}`,
      host: `127.0.0.1:${address.port}`,
      "content-type": "application/json",
    };
    expect(
      (await get(address.port, path, "POST", headers, JSON.stringify({ expectedVersion: 3 })))
        .status,
    ).toBe(400);
    const response = await get(
      address.port,
      path,
      "POST",
      headers,
      JSON.stringify({ expectedVersion: 3, confirmedSignalId: signalId }),
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      mode: "paper",
      order: { signalId, state: "cancelled", version: 4 },
    });
    expect(queries).toBe(1);
  });

  it("guards full paper-position close requests with exact observed inventory", async () => {
    const mint = "So11111111111111111111111111111111111111112";
    let queries = 0;
    const server = createPaperDashboardServer({
      database: {
        query: async () => {
          queries += 1;
          return {
            rows: [
              {
                id: "123e4567-e89b-42d3-a456-426614174011",
                token_mint: mint,
                expected_open_amount_raw: "9000",
                requested_at: "2026-08-11T10:00:00Z",
              },
            ],
          };
        },
        end: async () => undefined,
      } as never,
      wallet: "paper-wallet" as never,
      publicDirectory: "frontend",
      mutationToken: "e".repeat(32),
    });
    servers.push(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test address");
    const headers = {
      authorization: `Bearer ${"e".repeat(32)}`,
      origin: `http://127.0.0.1:${address.port}`,
      host: `127.0.0.1:${address.port}`,
      "content-type": "application/json",
    };
    const path = `/api/paper/positions/${mint}/close`;
    const response = await get(
      address.port,
      path,
      "POST",
      headers,
      JSON.stringify({ confirmedMint: mint, expectedOpenAmountRaw: "9000" }),
    );
    expect(response.status).toBe(202);
    expect(JSON.parse(response.body)).toMatchObject({
      mode: "paper",
      closeRequest: { tokenMint: mint, expectedOpenAmountRaw: "9000", state: "pending" },
    });
    expect(
      (
        await get(
          address.port,
          path,
          "POST",
          headers,
          JSON.stringify({ confirmedMint: mint, expectedOpenAmountRaw: "0" }),
        )
      ).status,
    ).toBe(400);
    expect(queries).toBe(1);
  });
});
