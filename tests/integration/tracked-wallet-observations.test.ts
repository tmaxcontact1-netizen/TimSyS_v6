import { describe, expect, it } from "vitest";
import { runTrackedWalletObservationCycle } from "../../src/application/services/tracked-wallet-observations.js";
import type { TrackedWalletPurchaseObservation } from "../../src/application/ports/stream.js";
import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletId,
} from "../../src/domain/shared/types.js";
import { PostgresTrackedWalletObservationRepository } from "../../src/infrastructure/database/tracked-wallet-observations.js";

const walletId = asUuid<WalletId>("00000000-0000-4000-8000-000000001911");
const wallet = "Wallet111111111111111111111111111111111111" as never;
const now = asTimestamp("2026-08-04T20:00:00Z");
function database(
  options: { rows?: readonly Record<string, unknown>[]; failInsert?: boolean } = {},
) {
  const queries: string[] = [];
  return {
    queries,
    port: {
      connect: async () => ({
        query: async (text: string) => {
          queries.push(text);
          if (options.failInsert && text.includes("INSERT INTO tracked_wallet_purchase"))
            throw new Error("insert failed");
          return {
            rows: options.rows ?? [],
            rowCount: text.includes("INSERT INTO tracked_wallet_purchase") ? 1 : 0,
          };
        },
        release: () => undefined,
      }),
    } as never,
  };
}
const observation: TrackedWalletPurchaseObservation = {
  walletId,
  wallet,
  signature: "sig-1",
  mint: "mint" as never,
  purchasedAt: now,
  observedAt: now,
  slot: 1n as never,
  acquiredAmountRaw: 2n as never,
  nativeSpentLamports: 3n as never,
  trace: {
    evidenceId: asUuid<EvidenceId>("00000000-0000-4000-8000-000000001912"),
    provider: "helius",
    method: "test",
    requestedAt: now,
    respondedAt: now,
    sourceTimestamp: now,
    normalizedAt: now,
    sourceKey: "key",
    contentHash: "hash",
    slot: 1n as never,
  },
};

describe("tracked-wallet observation persistence", () => {
  it("loads only qualified trading-authority wallets", async () => {
    const db = database({ rows: [{ id: walletId, address: wallet, last_signature: "sig-0" }] });
    await expect(
      new PostgresTrackedWalletObservationRepository(db.port).loadTrackedWallets(),
    ).resolves.toEqual([{ walletId, wallet, afterSignature: "sig-0" }]);
    expect(db.queries[0]).toContain("current_tier IN ('tier_a','tier_b')");
  });

  it("commits evidence and cursor atomically", async () => {
    const db = database();
    await expect(
      new PostgresTrackedWalletObservationRepository(db.port).recordPurchases({
        walletId,
        observedAt: now,
        observations: [observation],
      }),
    ).resolves.toBe(1);
    expect(db.queries[0]).toBe("BEGIN");
    expect(db.queries.at(-1)).toBe("COMMIT");
    expect(db.queries.some((query) => query.includes("tracked_wallet_cursors"))).toBe(true);
  });

  it("rolls back without advancing the cursor when evidence storage fails", async () => {
    const db = database({ failInsert: true });
    await expect(
      new PostgresTrackedWalletObservationRepository(db.port).recordPurchases({
        walletId,
        observedAt: now,
        observations: [observation],
      }),
    ).rejects.toThrow("insert failed");
    expect(db.queries.at(-1)).toBe("ROLLBACK");
    expect(db.queries.some((query) => query.includes("tracked_wallet_cursors"))).toBe(false);
  });

  it("rejects evidence for a different wallet authority", async () => {
    await expect(
      runTrackedWalletObservationCycle({
        repository: {
          loadTrackedWallets: async () => [{ walletId, wallet, afterSignature: null }],
          recordPurchases: async () => 0,
        },
        source: {
          observePurchases: async () => [
            { ...observation, walletId: asUuid<WalletId>("00000000-0000-4000-8000-000000001913") },
          ],
        },
        now: () => now,
      }),
    ).rejects.toThrow("mismatched authority");
  });
});
