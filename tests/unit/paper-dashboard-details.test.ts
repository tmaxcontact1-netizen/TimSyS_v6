import { describe, expect, it } from "vitest";

import { readPaperDashboardDetails } from "../../src/infrastructure/database/paper-dashboard.js";

describe("paper dashboard details", () => {
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
});
