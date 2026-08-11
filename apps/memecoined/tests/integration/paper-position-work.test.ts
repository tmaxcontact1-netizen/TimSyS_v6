import { expect, it } from "vitest";

import { PostgresPaperPositionWorkQueue } from "../../src/infrastructure/database/paper-position-work.js";

it("claims aggregate open quantity with a database lease", async () => {
  const statements: string[] = [];
  const queue = new PostgresPaperPositionWorkQueue(
    {
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("WITH due AS"))
          return {
            rowCount: 1,
            rows: [
              {
                token_mint: "token",
                open_amount_raw: "125",
                lease_acquired_at: "2026-08-10T12:00:00.000Z",
              },
            ],
          };
        return { rowCount: 1, rows: [] };
      },
    } as never,
    "wallet" as never,
  );
  const leases = await queue.claim({
    ownerId: "worker",
    now: "2026-08-10T12:00:00.000Z" as never,
    leaseExpiresAt: "2026-08-10T12:01:00.000Z" as never,
    limit: 25,
  });
  expect(leases[0]).toMatchObject({
    tokenMint: "token",
    openAmountRaw: 125n,
    leaseOwner: "worker",
  });
  expect(statements[0]).toContain("INSERT INTO paper_position_work");
  expect(statements[1]).toContain("FOR UPDATE SKIP LOCKED");
});

it("fences stale completion by acquisition instant", async () => {
  const queue = new PostgresPaperPositionWorkQueue(
    { query: async () => ({ rowCount: 0, rows: [] }) } as never,
    "wallet" as never,
  );
  await expect(
    queue.complete({
      lease: {
        tokenMint: "token" as never,
        openAmountRaw: 1n,
        leaseOwner: "worker",
        leaseAcquiredAt: "2026-08-10T12:00:00.000Z" as never,
      },
      fill: null,
      monitoredAt: "2026-08-10T12:00:01.000Z" as never,
      nextAt: "2026-08-10T12:00:30.000Z" as never,
    }),
  ).rejects.toThrow(/active lease/);
});
