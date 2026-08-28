import { expect, it } from "vitest";

import { PostgresOperatorApprovalStore } from "../../src/infrastructure/database/operator-approvals.js";

function database(updateRows = 1) {
  const statements: string[] = [];
  return {
    statements,
    port: {
      connect: async () => ({
        query: async (sql: string) => {
          statements.push(sql);
          return { rowCount: sql.startsWith("UPDATE operator_approvals") ? updateRows : 1, rows: [] };
        },
        release: () => undefined,
      }),
    },
  };
}

it("atomically approves and consumes one exactly bound authority", async () => {
  const db = database();
  const store = new PostgresOperatorApprovalStore(db.port as never);
  await store.decide({
    id: "approval", nonceHash: "a".repeat(64), decision: "approve", actorId: "operator",
    reason: null, decidedAt: "2026-08-27T12:00:01.000Z" as never,
  });
  await store.consume({
    id: "approval", payloadHash: "b".repeat(64),
    eligibilityHash: "c".repeat(64), quoteFingerprint: "quote", actorId: "executor",
    consumedAt: "2026-08-27T12:00:02.000Z" as never,
  });
  expect(db.statements.filter((sql) => sql === "COMMIT")).toHaveLength(2);
  expect(db.statements.some((sql) => sql.includes("state='approved'"))).toBe(true);
  expect(db.statements.some((sql) => sql.includes("state='consumed'"))).toBe(true);
  expect(db.statements.some((sql) => sql.includes("payload_hash=$2"))).toBe(true);
});

it("rolls back replayed or stale authority", async () => {
  const db = database(0);
  await expect(new PostgresOperatorApprovalStore(db.port as never).consume({
    id: "approval", payloadHash: "b".repeat(64),
    eligibilityHash: "c".repeat(64), quoteFingerprint: "quote", actorId: "executor",
    consumedAt: "2026-08-27T12:00:02.000Z" as never,
  })).rejects.toThrow(/stale|already used/);
  expect(db.statements.at(-1)).toBe("ROLLBACK");
});
