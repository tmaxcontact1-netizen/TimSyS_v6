import { expect, it } from "vitest";

import type { PaperFill } from "../../src/application/services/paper-accounting.js";
import { PostgresPaperAccountingLedger } from "../../src/infrastructure/database/paper-accounting.js";

const fill = {
  id: "00000000-0000-4000-8000-000000000911",
  wallet: "paper-wallet",
  side: "buy",
  tokenMint: "token-mint",
  tokenAmountRaw: 1_000n,
  settlementAmountRaw: 25n,
  quotedAt: "2026-08-10T10:00:00.000Z",
  filledAt: "2026-08-10T10:00:01.000Z",
  quoteFingerprint: "paper-quote-1",
} as PaperFill;

function database(cashRaw: string) {
  const statements: string[] = [];
  return {
    statements,
    port: {
      connect: async () => ({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.includes("initial_cash_raw::text"))
            return { rowCount: 1, rows: [{ initial_cash_raw: cashRaw }] };
          if (sql.includes("AS net_raw")) return { rowCount: 1, rows: [{ net_raw: "0" }] };
          return { rowCount: 1, rows: [] };
        },
        release: () => undefined,
      }),
    },
  };
}

it("atomically records a paper buy, lot, and cash event", async () => {
  const db = database("100");
  await new PostgresPaperAccountingLedger(db.port as never).recordFill(fill);
  expect(db.statements.some((sql) => sql.includes("INSERT INTO paper_fills"))).toBe(true);
  expect(db.statements.some((sql) => sql.includes("INSERT INTO paper_position_lots"))).toBe(true);
  expect(db.statements.some((sql) => sql.includes("INSERT INTO paper_cash_events"))).toBe(true);
  expect(db.statements.at(-1)).toBe("COMMIT");
});

it("rolls back a paper buy that exceeds available cash", async () => {
  const db = database("24");
  await expect(
    new PostgresPaperAccountingLedger(db.port as never).recordFill(fill),
  ).rejects.toThrow(/available cash/);
  expect(db.statements.at(-1)).toBe("ROLLBACK");
  expect(db.statements.some((sql) => sql.includes("INSERT INTO paper_fills"))).toBe(false);
});
