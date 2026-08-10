import { describe, expect, it } from "vitest";

import { PostgresOpenPositionInventorySource } from "../../src/infrastructure/database/open-position-inventory.js";
import {
  asRawAmount,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");
const wallet = "wallet" as WalletAddress;
const trace = Object.freeze({
  evidenceId: asUuid<EvidenceId>("11111111-1111-4111-8111-111111111111"),
  provider: "helius" as const,
  method: "getBalance",
  requestedAt: at,
  respondedAt: at,
  sourceTimestamp: null,
  normalizedAt: at,
  sourceKey: "wallet",
  contentHash: "a".repeat(64),
  slot: asSolanaSlot(1n),
});

function chain(nativeBalanceLamports = 2_000_000_000n) {
  return {
    observeWalletInventory: async () => ({
      ok: true as const,
      value: Object.freeze({
        wallet,
        nativeBalanceLamports: asRawAmount(nativeBalanceLamports),
        tokens: Object.freeze([]),
        slot: asSolanaSlot(1n),
        agreeingProviders: Object.freeze(["helius" as const, "solana_rpc" as const]),
        traces: Object.freeze([trace]),
      }),
    }),
  };
}

describe("PostgreSQL open position inventory", () => {
  it("joins active reservations to agreed native liquidity", async () => {
    const database = {
      query: async (text: string) =>
        text.includes("FROM jobs")
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ reserved_sol: "0.75" }] },
    };
    const result = await new PostgresOpenPositionInventorySource(
      database as never,
      chain(),
      wallet,
    ).observeInventory(at);
    expect(result.liquidNativeSol.toString()).toBe("2");
    expect(result.reservedEntryCostSol.toString()).toBe("0.75");
    expect(result.positions).toEqual([]);
    expect(result.evidence).toHaveLength(1);
  });

  it("fails closed when reservations exceed native liquidity", async () => {
    const database = {
      query: async (text: string) =>
        text.includes("FROM jobs")
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ reserved_sol: "2.01" }] },
    };
    await expect(
      new PostgresOpenPositionInventorySource(database as never, chain(), wallet).observeInventory(
        at,
      ),
    ).rejects.toThrow("exceed native liquidity");
  });

  it("fails closed without complete reservation authority", async () => {
    const database = { query: async () => ({ rowCount: 0, rows: [] }) };
    await expect(
      new PostgresOpenPositionInventorySource(database as never, chain(), wallet).observeInventory(
        at,
      ),
    ).rejects.toThrow("reservation authority");
  });
});
