import { describe, expect, it } from "vitest";

import { PostgresPaperEntryWorkQueue } from "../../src/infrastructure/database/paper-entry-work.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

function database(rows: readonly Record<string, string>[] = []) {
  const statements: string[] = [];
  return {
    statements,
    port: {
      connect: async () => ({
        query: async (sql: string) => {
          statements.push(sql);
          if (sql.includes("RETURNING j.id::text")) return { rowCount: rows.length, rows };
          return { rowCount: 1, rows: [] };
        },
        release: () => undefined,
      }),
    } as never,
  };
}

const lease = Object.freeze({
  signalId: "00000000-0000-4000-8000-000000000901",
  riskRunId: "risk-paper-1",
  tokenMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as never,
  inputAmountRaw: 1_250_000_000n,
  leaseOwner: "paper-01",
});

describe("PostgreSQL paper entry lifecycle", () => {
  it("leases approved entry work and converts SOL exactly to lamports", async () => {
    const db = database([
      {
        signal_id: lease.signalId,
        risk_run_id: lease.riskRunId,
        mint_address: lease.tokenMint,
        position_size_sol: "1.25",
      },
    ]);
    const queue = new PostgresPaperEntryWorkQueue(db.port);
    await expect(
      queue.claim({
        ownerId: "paper-01",
        now: asTimestamp("2026-08-10T10:00:00Z"),
        leaseExpiresAt: asTimestamp("2026-08-10T10:01:00Z"),
        limit: 25,
      }),
    ).resolves.toEqual([lease]);
    expect(db.statements.some((sql) => sql.includes("FOR UPDATE OF j SKIP LOCKED"))).toBe(true);
  });

  it("atomically binds the fill and completes the approval lifecycle", async () => {
    const db = database();
    const queue = new PostgresPaperEntryWorkQueue(db.port);
    await queue.complete({
      lease,
      fill: {
        id: "00000000-0000-4000-8000-000000000902",
        wallet: "paper-wallet" as never,
        side: "buy",
        tokenMint: lease.tokenMint,
        tokenAmountRaw: 50_000n,
        settlementAmountRaw: lease.inputAmountRaw,
        quotedAt: asTimestamp("2026-08-10T10:00:00Z"),
        filledAt: asTimestamp("2026-08-10T10:00:01Z"),
        quoteFingerprint: "quote-paper-1",
      },
    });
    expect(db.statements.some((sql) => sql.includes("paper_entry_executions"))).toBe(true);
    expect(db.statements.some((sql) => sql.includes("state='opened'"))).toBe(true);
    expect(db.statements.some((sql) => sql.includes("state='converted'"))).toBe(true);
    expect(db.statements.at(-1)).toBe("COMMIT");
  });
});
