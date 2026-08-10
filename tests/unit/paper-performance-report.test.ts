import { describe, expect, it } from "vitest";

import { readPaperPerformanceReport } from "../../src/workers/health-worker.js";

describe("paper performance reporting", () => {
  it("projects durable capital, performance, work, and health facts", async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            initial_cash_raw: "10000000000",
            cash_raw: "9250000000",
            open_cost_raw: "500000000",
            realized_pnl_raw: "250000000",
            fills: "7",
            open_positions: "2",
            pending_entries: "1",
            pending_positions: "2",
            worker_errors: "0",
          },
        ],
      }),
    };
    await expect(
      readPaperPerformanceReport(database as never, "paper-wallet" as never),
    ).resolves.toEqual({
      wallet: "paper-wallet",
      initialCashRaw: "10000000000",
      cashRaw: "9250000000",
      openCostRaw: "500000000",
      realizedPnlRaw: "250000000",
      fills: 7,
      openPositions: 2,
      pendingEntries: 1,
      pendingPositions: 2,
      workerErrors: 0,
      healthy: true,
    });
  });

  it("reports unhealthy durable worker errors", async () => {
    const database = {
      query: async () => ({
        rows: [
          {
            initial_cash_raw: "1",
            cash_raw: "1",
            open_cost_raw: "0",
            realized_pnl_raw: "0",
            fills: "0",
            open_positions: "0",
            pending_entries: "0",
            pending_positions: "0",
            worker_errors: "2",
          },
        ],
      }),
    };
    expect((await readPaperPerformanceReport(database as never, "wallet" as never)).healthy).toBe(
      false,
    );
  });

  it("refuses reporting before account initialization", async () => {
    await expect(
      readPaperPerformanceReport({ query: async () => ({ rows: [] }) } as never, "wallet" as never),
    ).rejects.toThrow(/unavailable/);
  });
});
