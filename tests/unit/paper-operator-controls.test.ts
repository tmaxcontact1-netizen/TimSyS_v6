import { describe, expect, it } from "vitest";

import {
  cancelPendingPaperEntry,
  PaperControlConflictError,
  requestPaperPositionClose,
} from "../../src/infrastructure/database/paper-operator-controls.js";

describe("paper operator controls", () => {
  it("cancels only an available versioned paper entry and audits atomically", async () => {
    let sql = "";
    let parameters: unknown[] = [];
    const database = {
      query: async (statement: string, supplied: unknown[]) => {
        sql = statement;
        parameters = supplied;
        return { rows: [{ signal_id: "123e4567-e89b-42d3-a456-426614174000", version: "8" }] };
      },
    };
    const cancelled = await cancelPendingPaperEntry(
      database as never,
      "paper-wallet" as never,
      "123e4567-e89b-42d3-a456-426614174000",
      7,
      new Date("2026-08-11T10:00:00Z"),
    );
    expect(cancelled).toEqual({
      signalId: "123e4567-e89b-42d3-a456-426614174000",
      state: "cancelled",
      version: 8,
    });
    expect(sql).toContain("j.state='available'");
    expect(sql).toContain("o.wallet_address=$1");
    expect(sql).toContain("entry_cancelled");
    expect(parameters.slice(0, 4)).toEqual([
      "paper-wallet",
      "123e4567-e89b-42d3-a456-426614174000",
      7,
      new Date("2026-08-11T10:00:00Z"),
    ]);
    expect(Object.isFrozen(cancelled)).toBe(true);
  });

  it("fails closed when an entry is leased, stale, or outside the wallet", async () => {
    const database = { query: async () => ({ rows: [] }) };
    await expect(
      cancelPendingPaperEntry(
        database as never,
        "paper-wallet" as never,
        "123e4567-e89b-42d3-a456-426614174000",
        1,
        new Date(),
      ),
    ).rejects.toBeInstanceOf(PaperControlConflictError);
  });

  it("creates an exact-inventory full-close request with an atomic audit fact", async () => {
    let sql = "";
    let parameters: unknown[] = [];
    const database = {
      query: async (statement: string, supplied: unknown[]) => {
        sql = statement;
        parameters = supplied;
        return {
          rows: [
            {
              id: "123e4567-e89b-42d3-a456-426614174001",
              token_mint: "So11111111111111111111111111111111111111112",
              expected_open_amount_raw: "2500000",
              requested_at: "2026-08-11T10:00:00Z",
            },
          ],
        };
      },
    };
    const requested = await requestPaperPositionClose(
      database as never,
      "paper-wallet" as never,
      "So11111111111111111111111111111111111111112" as never,
      2_500_000n,
      new Date("2026-08-11T10:00:00Z"),
    );
    expect(requested).toMatchObject({ expectedOpenAmountRaw: "2500000", state: "pending" });
    expect(sql).toContain("HAVING sum(current_amount_raw)=$3::numeric");
    expect(sql).toContain("position_close_requested");
    expect(parameters.slice(0, 3)).toEqual([
      "paper-wallet",
      "So11111111111111111111111111111111111111112",
      "2500000",
    ]);
    expect(Object.isFrozen(requested)).toBe(true);
  });

  it("rejects stale inventory and duplicate pending close requests", async () => {
    const database = { query: async () => ({ rows: [] }) };
    await expect(
      requestPaperPositionClose(
        database as never,
        "paper-wallet" as never,
        "So11111111111111111111111111111111111111112" as never,
        1n,
        new Date(),
      ),
    ).rejects.toBeInstanceOf(PaperControlConflictError);
  });
});
