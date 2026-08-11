import { describe, expect, it } from "vitest";

import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { HeliusWalletHistoryAdapter } from "../../src/infrastructure/providers/helius/wallet-history-adapter.js";

const wallet = "wallet" as WalletAddress;
const requestedAt = asTimestamp("2026-08-05T12:00:00Z");
const coverageRequiredAt = asTimestamp("2026-08-01T00:00:00Z");
const seconds = (value: string): number => Math.floor(new Date(value).getTime() / 1_000);
const transaction = (index: number, timestamp: number, feePayer: string = wallet) => ({
  signature: `signature-${index}`,
  slot: index,
  timestamp,
  transactionError: null,
  feePayer,
});

function adapter(pages: readonly unknown[]) {
  const urls: string[] = [];
  let index = 0;
  return {
    urls,
    value: new HeliusWalletHistoryAdapter(
      {
        get: async (url: string) => {
          urls.push(url);
          return { status: 200, body: pages[index++], receivedAt: requestedAt };
        },
      } as never,
      "secret",
      {
        createEvidenceId: () => asUuid<EvidenceId>("00000000-0000-4000-8000-000000000001"),
      },
    ),
  };
}

describe("Helius wallet history", () => {
  it("paginates until the required boundary and preserves wallet-initiated outcomes", async () => {
    const newest = Array.from({ length: 100 }, (_, index) =>
      transaction(index, seconds("2026-08-05T11:00:00Z") - index),
    );
    const source = adapter([
      newest,
      [
        transaction(100, seconds("2026-08-01T00:01:00Z")),
        {
          ...transaction(101, seconds("2026-08-01T00:00:30Z")),
          transactionError: { failed: true },
        },
        transaction(102, seconds("2026-07-31T23:59:59Z")),
        transaction(103, seconds("2026-08-01T00:00:20Z"), "another-wallet"),
      ],
    ]);
    const result = await source.value.observe({ wallet, requestedAt, coverageRequiredAt });
    expect(source.urls).toHaveLength(2);
    expect(new URL(source.urls[1]!).searchParams.get("before")).toBe("signature-99");
    expect(result.transactions.some(({ signature }) => signature === "signature-101")).toBe(true);
    expect(
      result.transactions.find(({ signature }) => signature === "signature-101")?.successful,
    ).toBe(false);
    expect(result.transactions.some(({ signature }) => signature === "signature-102")).toBe(false);
    expect(result.transactions.some(({ signature }) => signature === "signature-103")).toBe(false);
  });

  it("rejects malformed or duplicated provider history", async () => {
    await expect(
      adapter([
        [
          transaction(1, seconds("2026-08-02T00:00:00Z")),
          transaction(1, seconds("2026-08-02T00:00:00Z")),
        ],
      ]).value.observe({
        wallet,
        requestedAt,
        coverageRequiredAt,
      }),
    ).rejects.toThrow(/duplicate signatures/);
    await expect(
      adapter([[{ signature: "missing-authority" }]]).value.observe({
        wallet,
        requestedAt,
        coverageRequiredAt,
      }),
    ).rejects.toThrow(/Malformed/);
  });
});
