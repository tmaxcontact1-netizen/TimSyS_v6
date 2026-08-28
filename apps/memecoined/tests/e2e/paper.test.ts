import { describe, expect, it, vi } from "vitest";
import {
  PaperQuoteExecutionService,
  runPaperEntryExecutionCycle,
} from "../../src/application/services/paper-execution.js";
import { createExecutableQuote } from "../../src/domain/trading/quote.js";
import {
  asBasisPoints,
  asPercentage,
  asRawAmount,
  asTimestamp,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
const requested = asTimestamp("2026-08-26T12:10:00Z"),
  received = asTimestamp("2026-08-26T12:10:00.500Z"),
  filled = asTimestamp("2026-08-26T12:10:01Z"),
  sol = asMintAddress("So11111111111111111111111111111111111111112"),
  token = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  lease = {
    signalId: "signal",
    riskRunId: "risk",
    tokenMint: token,
    inputAmountRaw: 25n,
    leaseOwner: "paper",
  };
const quote = createExecutableQuote({
  fingerprint: "paper-e2e",
  inputMint: sol,
  outputMint: token,
  inputAmount: asRawAmount(25n),
  expectedOutputAmount: asRawAmount(1000n),
  minimumOutputAmount: asRawAmount(950n),
  slippageBasisPoints: asBasisPoints(150n),
  priceImpactPercentage: asPercentage("0.1"),
  routePlan: ["route"],
  contextSlot: null,
  requestedAt: requested,
  receivedAt: received,
  evidence: [
    {
      id: "00000000-0000-4000-8000-000000000131",
      provider: "jupiter",
      observedAt: received,
      sourceKey: "quote",
    } as never,
  ],
});
describe("paper promotion journey", () => {
  it("converts approved work into a durable simulated fill without signing", async () => {
    const recordFill = vi.fn(),
      complete = vi.fn(),
      retry = vi.fn();
    const execution = new PaperQuoteExecutionService(
      "paper-wallet" as never,
      { quote: async () => ({ ok: true, value: quote }) },
      { recordFill },
      () => filled,
    );
    const fills = await runPaperEntryExecutionCycle({
      queue: { claim: async () => [lease], complete, retry },
      execution,
      ownerId: "paper",
      now: () => requested,
      leaseExpiresAt: () => filled,
      retryAt: () => filled,
    });
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({
      side: "buy",
      tokenAmountRaw: 1000n,
      settlementAmountRaw: 25n,
    });
    expect(fills[0]).not.toHaveProperty("signature");
    expect(recordFill).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });
  it("rejects stale executable quotes without a fill", async () => {
    const recordFill = vi.fn(),
      retry = vi.fn();
    const execution = new PaperQuoteExecutionService(
      "paper-wallet" as never,
      { quote: async () => ({ ok: true, value: quote }) },
      { recordFill },
      () => asTimestamp("2026-08-26T12:10:03Z"),
    );
    const fills = await runPaperEntryExecutionCycle({
      queue: { claim: async () => [lease], complete: vi.fn(), retry },
      execution,
      ownerId: "paper",
      now: () => requested,
      leaseExpiresAt: () => filled,
      retryAt: () => filled,
    });
    expect(fills).toEqual([]);
    expect(recordFill).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringMatching(/fresh quote/) }),
    );
  });
});
