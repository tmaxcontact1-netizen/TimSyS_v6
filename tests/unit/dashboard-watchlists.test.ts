import { describe, expect, it } from "vitest";

import {
  addDashboardWatchlistToken,
  listDashboardWatchlists,
  WatchlistConflictError,
} from "../../src/infrastructure/database/dashboard-watchlists.js";

describe("dashboard watchlists", () => {
  it("returns immutable bounded wallet-scoped lists", async () => {
    let parameters: unknown[] | undefined;
    const database = {
      query: async (_sql: string, values: unknown[]) => {
        parameters = values;
        return {
          rows: [
            {
              id: "id",
              name: "Primary",
              version: "2",
              created_at: "2026-08-10T10:00:00Z",
              updated_at: "2026-08-10T11:00:00Z",
              tokens: ["So11111111111111111111111111111111111111112"],
            },
          ],
        };
      },
    };
    const lists = await listDashboardWatchlists(database as never, "wallet" as never);
    expect(parameters).toEqual(["wallet"]);
    expect(lists).toEqual([
      {
        id: "id",
        name: "Primary",
        version: 2,
        createdAt: "2026-08-10T10:00:00.000Z",
        updatedAt: "2026-08-10T11:00:00.000Z",
        tokens: ["So11111111111111111111111111111111111111112"],
      },
    ]);
    expect(Object.isFrozen(lists[0]?.tokens)).toBe(true);
  });

  it("fails closed when a versioned token mutation changes nothing", async () => {
    const database = { query: async () => ({ rows: [] }) };
    await expect(
      addDashboardWatchlistToken(
        database as never,
        "wallet" as never,
        "123e4567-e89b-42d3-a456-426614174000",
        "So11111111111111111111111111111111111111112" as never,
        3,
        new Date("2026-08-10T12:00:00Z"),
      ),
    ).rejects.toBeInstanceOf(WatchlistConflictError);
  });
});
