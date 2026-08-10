import { describe, expect, it } from "vitest";

import {
  readPaperDashboardDetails,
  readPaperPerformanceHistory,
  readPaperTokenDetails,
} from "../../src/infrastructure/database/paper-dashboard.js";

describe("paper dashboard details", () => {
  it("reads bounded realized book-equity history for a fixed range", async () => {
    const queries: { text: string; values: readonly unknown[] }[] = [];
    const database = {
      query: async (text: string, values: readonly unknown[]) => {
        queries.push({ text, values });
        return {
          rows: [
            {
              occurred_at: new Date("2026-08-10T00:00:00Z"),
              realized_pnl_raw: "5",
              book_equity_raw: "105",
            },
          ],
        };
      },
    };
    const points = await readPaperPerformanceHistory(database as never, "wallet" as never, "7d");
    expect(points).toEqual([
      { occurredAt: "2026-08-10T00:00:00.000Z", realizedPnlRaw: "5", bookEquityRaw: "105" },
    ]);
    expect(queries[0]?.values).toEqual(["wallet", "7 days"]);
    expect(queries[0]?.text).toContain("recency<=499");
  });
  it("reads bounded detail panels in one snapshot statement", async () => {
    const queries: { text: string; values: readonly unknown[] }[] = [];
    const database = {
      query: async (text: string, values: readonly unknown[]) => {
        queries.push({ text, values });
        return {
          rows: [{ positions: [{ token_mint: "mint" }], fills: [], performance: [], events: [] }],
        };
      },
    };
    const result = await readPaperDashboardDetails(database as never, "wallet" as never);
    expect(result.positions).toHaveLength(1);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.values).toEqual(["wallet"]);
    expect(queries[0]?.text).toContain("LIMIT 50");
    expect(queries[0]?.text.match(/LIMIT 100/g)).toHaveLength(3);
  });

  it("rejects malformed database payloads", async () => {
    const database = {
      query: async () => ({ rows: [{ positions: null, fills: [], performance: [], events: [] }] }),
    };
    await expect(readPaperDashboardDetails(database as never, "wallet" as never)).rejects.toThrow(
      /positions/,
    );
  });

  it("reads one bounded token lifecycle in one snapshot statement", async () => {
    const queries: { text: string; values: readonly unknown[] }[] = [];
    const database = {
      query: async (text: string, values: readonly unknown[]) => {
        queries.push({ text, values });
        return {
          rows: [
            {
              summary: { token_mint: "mint", open_amount_raw: "4" },
              lots: [{ current_amount_raw: "4" }],
              fills: [],
              performance: [],
              events: [],
            },
          ],
        };
      },
    };
    const result = await readPaperTokenDetails(
      database as never,
      "wallet" as never,
      "mint" as never,
    );
    expect(result.summary.open_amount_raw).toBe("4");
    expect(result.lots).toHaveLength(1);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.values).toEqual(["wallet", "mint"]);
    expect(queries[0]?.text).toContain("token_mint=$2");
    expect(queries[0]?.text.match(/LIMIT 100/g)).toHaveLength(3);
  });
});
