import { describe, expect, it } from "vitest";
import { asTimestamp, asUuid, type WalletId } from "../../src/domain/shared/types.js";
import { HeliusTrackedWalletPurchaseAdapter } from "../../src/infrastructure/providers/helius/stream-adapter.js";
import { DeterministicEvidenceIdentityFactory } from "../../src/infrastructure/runtime/evidence-id.js";

const walletId = asUuid<WalletId>("00000000-0000-4000-8000-000000001901");
const wallet = "Wallet111111111111111111111111111111111111" as never;
const mint = "So11111111111111111111111111111111111111112";
const requestedAt = asTimestamp("2026-08-04T20:00:00Z");
const receivedAt = asTimestamp("2026-08-04T20:00:02Z");

function adapter(body: unknown, status = 200) {
  const urls: string[] = [];
  return {
    urls,
    value: new HeliusTrackedWalletPurchaseAdapter(
      {
        get: async (url: string) => {
          urls.push(url);
          return { status, body, receivedAt };
        },
      } as never,
      "secret-key",
      new DeterministicEvidenceIdentityFactory(),
    ),
  };
}

describe("Helius tracked-wallet observations", () => {
  it("normalizes successful acquisitions without inventing USD valuation", async () => {
    const source = adapter([
      {
        signature: "sig-1",
        slot: 123,
        timestamp: 1_775_500_000,
        transactionError: null,
        tokenTransfers: [
          { mint, toUserAccount: wallet, rawTokenAmount: { tokenAmount: "2500000", decimals: 6 } },
        ],
        nativeTransfers: [{ fromUserAccount: wallet, amount: 500_000_000 }],
      },
    ]);
    const result = await source.value.observePurchases({
      walletId,
      wallet,
      afterSignature: "sig-0",
      requestedAt,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      signature: "sig-1",
      acquiredAmountRaw: 2_500_000n,
      tokenDecimals: 6,
      nativeSpentLamports: 500_000_000n,
      slot: 123n,
    });
    expect(source.urls[0]).toContain("until=sig-0");
  });

  it("ignores failed and outbound transfers", async () => {
    const result = await adapter([
      {
        signature: "failed",
        slot: 1,
        timestamp: 1_775_500_000,
        transactionError: { message: "failed" },
        tokenTransfers: [
          { mint, toUserAccount: wallet, rawTokenAmount: { tokenAmount: "1", decimals: 0 } },
        ],
        nativeTransfers: [],
      },
      {
        signature: "outbound",
        slot: 2,
        timestamp: 1_775_500_000,
        transactionError: null,
        tokenTransfers: [
          {
            mint,
            toUserAccount: "someone-else",
            rawTokenAmount: { tokenAmount: "1", decimals: 0 },
          },
        ],
        nativeTransfers: [],
      },
    ]).value.observePurchases({ walletId, wallet, afterSignature: null, requestedAt });
    expect(result).toEqual([]);
  });

  it("fails closed on malformed responses and provider failure", async () => {
    await expect(
      adapter({ unexpected: true }).value.observePurchases({
        walletId,
        wallet,
        afterSignature: null,
        requestedAt,
      }),
    ).rejects.toThrow("Malformed");
    await expect(
      adapter([], 503).value.observePurchases({
        walletId,
        wallet,
        afterSignature: null,
        requestedAt,
      }),
    ).rejects.toThrow("temporarily unavailable");
  });
});
