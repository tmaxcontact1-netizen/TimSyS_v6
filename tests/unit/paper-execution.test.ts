import { describe, expect, it, vi } from "vitest";

import { PaperQuoteExecutionService } from "../../src/application/services/paper-execution.js";
import { createExecutableQuote } from "../../src/domain/trading/quote.js";
import {
  asBasisPoints,
  asPercentage,
  asRawAmount,
  asTimestamp,
  type MintAddress,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const sol = "So11111111111111111111111111111111111111112" as MintAddress;
const token = "token-mint" as MintAddress;
const wallet = "paper-wallet" as WalletAddress;
const receivedAt = asTimestamp("2026-08-10T10:00:00.500Z");

function quote(side: "buy" | "sell") {
  const inputMint = side === "buy" ? sol : token;
  const outputMint = side === "buy" ? token : sol;
  return createExecutableQuote({
    fingerprint: `quote-${side}`,
    inputMint,
    outputMint,
    inputAmount: asRawAmount(side === "buy" ? 25n : 1_000n),
    expectedOutputAmount: asRawAmount(side === "buy" ? 1_000n : 30n),
    minimumOutputAmount: asRawAmount(side === "buy" ? 950n : 28n),
    slippageBasisPoints: asBasisPoints(150n),
    priceImpactPercentage: asPercentage("0.1"),
    routePlan: Object.freeze(["route"]),
    contextSlot: null,
    requestedAt: asTimestamp("2026-08-10T10:00:00.000Z"),
    receivedAt,
    evidence: Object.freeze([
      {
        id: "00000000-0000-4000-8000-000000000001",
        provider: "jupiter",
        observedAt: receivedAt,
        sourceKey: "quote",
        contentHash: "a".repeat(64),
      } as never,
    ]),
  });
}

describe("paper quote execution", () => {
  it.each(["buy", "sell"] as const)("records a deterministic fresh %s fill", async (side) => {
    const ledger = { recordFill: vi.fn(async () => undefined) };
    const quotes = { quote: vi.fn(async () => ({ ok: true as const, value: quote(side) })) };
    const service = new PaperQuoteExecutionService(wallet, quotes, ledger, () =>
      asTimestamp("2026-08-10T10:00:01.000Z"),
    );
    const fill = await service.execute({
      side,
      tokenMint: token,
      inputAmountRaw: side === "buy" ? 25n : 1_000n,
      requestedAt: asTimestamp("2026-08-10T10:00:00.000Z"),
    });
    expect(fill).toMatchObject({
      wallet,
      side,
      tokenMint: token,
      tokenAmountRaw: 1_000n,
      settlementAmountRaw: side === "buy" ? 25n : 30n,
      quoteFingerprint: `quote-${side}`,
    });
    expect(fill.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ledger.recordFill).toHaveBeenCalledWith(fill);
  });

  it("rejects stale quote evidence before writing the ledger", async () => {
    const ledger = { recordFill: vi.fn(async () => undefined) };
    const service = new PaperQuoteExecutionService(
      wallet,
      { quote: async () => ({ ok: true as const, value: quote("buy") }) },
      ledger,
      () => asTimestamp("2026-08-10T10:00:02.501Z"),
    );
    await expect(
      service.execute({
        side: "buy",
        tokenMint: token,
        inputAmountRaw: 25n,
        requestedAt: asTimestamp("2026-08-10T10:00:00.000Z"),
      }),
    ).rejects.toThrow(/fresh quote/);
    expect(ledger.recordFill).not.toHaveBeenCalled();
  });
});
