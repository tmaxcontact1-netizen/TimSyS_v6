import { describe, expect, it } from "vitest";

import type { ObservationIdentityFactory } from "../../src/application/contracts/observations.js";
import type { ExactInputQuoteRequest } from "../../src/application/ports/swap.js";
import {
  asBasisPoints,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import {
  JupiterSwapAdapter,
  type TransactionSimulationClient,
} from "../../src/infrastructure/providers/jupiter/adapter.js";
import {
  JupiterSwapApiClient,
  type JupiterHttpTransport,
} from "../../src/infrastructure/providers/jupiter/client.js";

const inputMint = asMintAddress("So11111111111111111111111111111111111111112");
const outputMint = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const wallet = "Wallet111111111111111111111111111111111111" as WalletAddress;
const requestedAt = asTimestamp("2026-08-04T12:00:00Z");
const receivedAt = asTimestamp("2026-08-04T12:00:01Z");
let identity = 700;
const identities: ObservationIdentityFactory = {
  createEvidenceId: () =>
    asUuid<EvidenceId>(`00000000-0000-4000-8000-${(++identity).toString().padStart(12, "0")}`),
};

function quoteBody(overrides: Record<string, unknown> = {}) {
  return {
    inputMint,
    inAmount: "1000000000",
    outputMint,
    outAmount: "2500000",
    otherAmountThreshold: "2462500",
    swapMode: "ExactIn",
    slippageBps: 150,
    priceImpactPct: "1.25",
    routePlan: [
      {
        swapInfo: {
          ammKey: "amm-1",
          label: "Raydium",
          inputMint,
          outputMint,
          inAmount: "1000000000",
          outAmount: "2500000",
          feeAmount: "5000",
          feeMint: inputMint,
        },
        percent: 100,
      },
    ],
    contextSlot: 12345,
    platformFee: null,
    ...overrides,
  };
}

const request: ExactInputQuoteRequest = {
  inputMint,
  outputMint,
  inputAmount: asRawAmount(1_000_000_000n),
  slippageBasisPoints: asBasisPoints(150n),
  requestedAt,
};

function fixture(
  options: {
    quoteStatus?: number;
    quote?: unknown;
    swapStatus?: number;
    swap?: unknown;
    simulation?: unknown;
    rejectSimulation?: boolean;
  } = {},
) {
  const gets: Array<{ url: string; headers: Readonly<Record<string, string>> }> = [];
  const posts: Array<{ url: string; body: unknown; headers: Readonly<Record<string, string>> }> =
    [];
  const transport: JupiterHttpTransport = {
    get: async (url, headers) => {
      gets.push({ url, headers });
      return {
        status: options.quoteStatus ?? 200,
        body: options.quote ?? quoteBody(),
        receivedAt,
      };
    },
    post: async (url, body, headers) => {
      posts.push({ url, body, headers });
      return {
        status: options.swapStatus ?? 200,
        body:
          options.swap ??
          ({
            swapTransaction: Buffer.from("versioned-transaction").toString("base64"),
            lastValidBlockHeight: 987654,
            prioritizationFeeLamports: 5000,
          } as const),
        receivedAt,
      };
    },
  };
  const simulation: TransactionSimulationClient = {
    simulateTransaction: async () => {
      if (options.rejectSimulation === true) throw new Error("down");
      const result =
        options.simulation ??
        ({
          context: { slot: 12346 },
          value: { err: null, logs: ["Program success"], unitsConsumed: 180000 },
        } as const);
      return { result, raw: { jsonrpc: "2.0", id: 1, result }, receivedAt };
    },
  };
  return {
    adapter: new JupiterSwapAdapter(
      new JupiterSwapApiClient(transport, "secret-key"),
      simulation,
      identities,
    ),
    gets,
    posts,
  };
}

async function accepted(adapter: JupiterSwapAdapter) {
  const result = await adapter.quote(request);
  if (!result.ok) throw new Error(result.error.reason);
  return result.value;
}

describe("Jupiter executable swap contract", () => {
  it("normalizes an exact-input quote and binds its deterministic evidence", async () => {
    const value = fixture();
    const result = await value.adapter.quote(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      inputMint,
      outputMint,
      inputAmount: 1_000_000_000n,
      expectedOutputAmount: 2_500_000n,
      minimumOutputAmount: 2_462_500n,
      slippageBasisPoints: 150n,
      contextSlot: 12345n,
      requestedAt: "2026-08-04T12:00:00.000Z",
      receivedAt: "2026-08-04T12:00:01.000Z",
    });
    expect(result.value.priceImpactPercentage?.toString()).toBe("1.25");
    expect(result.value.routePlan[0]).toContain("amm-1:Raydium");
    expect(result.value.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.value.evidence[0]?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(value.gets[0]?.url).toContain("swapMode=ExactIn");
    expect(value.gets[0]?.url).toContain("restrictIntermediateTokens=true");
    expect(value.gets[0]?.headers["x-api-key"]).toBe("secret-key");
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("produces the same fingerprint for identical accepted quote facts", async () => {
    const first = await fixture().adapter.quote(request);
    const second = await fixture().adapter.quote(request);
    expect(first.ok && second.ok && first.value.fingerprint).toBe(
      second.ok ? second.value.fingerprint : "failed",
    );
  });

  it.each([
    [quoteBody({ inputMint: outputMint }), "validation"],
    [quoteBody({ outAmount: "0" }), "malformed"],
    [quoteBody({ routePlan: [] }), "malformed"],
    [quoteBody({ platformFee: { amount: "1" } }), "malformed"],
    [quoteBody({ priceImpactPct: "NaN" }), "malformed"],
  ] as const)("rejects mismatched or malformed quote %#", async (body, code) => {
    const result = await fixture({ quote: body }).adapter.quote(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it.each([
    [400, "validation", false],
    [429, "rate_limited", true],
    [503, "unavailable", true],
  ] as const)("classifies Jupiter status %s", async (status, code, retryable) => {
    const result = await fixture({ quoteStatus: status }).adapter.quote(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ code, retryable });
  });

  it("constructs with the exact provider quote and configured wallet", async () => {
    const value = fixture();
    const quote = await accepted(value.adapter);
    const result = await value.adapter.construct({ quote, wallet, requestedAt });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      quoteFingerprint: quote.fingerprint,
      wallet,
      lastValidBlockHeight: 987654n,
      prioritizationFeeLamports: 5000n,
    });
    const body = value.posts[0]?.body as {
      quoteResponse: unknown;
      userPublicKey: string;
      dynamicComputeUnitLimit: boolean;
    };
    expect(body.quoteResponse).toEqual(quoteBody());
    expect(body.userPublicKey).toBe(wallet);
    expect(body.dynamicComputeUnitLimit).toBe(true);
    expect(result.value.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects construction from a quote not accepted by this adapter", async () => {
    const first = fixture();
    const quote = await accepted(first.adapter);
    const result = await fixture().adapter.construct({ quote, wallet, requestedAt });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("rejects an altered quote carrying a previously accepted fingerprint", async () => {
    const value = fixture();
    const quote = await accepted(value.adapter);
    const altered = Object.freeze({ ...quote, routePlan: Object.freeze(["altered-route"]) });
    const result = await value.adapter.construct({ quote: altered, wallet, requestedAt });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("rejects malformed serialized transactions", async () => {
    const value = fixture({ swap: { swapTransaction: "not base64", lastValidBlockHeight: 1 } });
    const quote = await accepted(value.adapter);
    const result = await value.adapter.construct({ quote, wallet, requestedAt });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("malformed");
  });

  it("simulates the exact constructed transaction and binds current slot and quote", async () => {
    const value = fixture();
    const quote = await accepted(value.adapter);
    const swap = await value.adapter.construct({ quote, wallet, requestedAt });
    if (!swap.ok) throw new Error(swap.error.reason);
    const result = await value.adapter.simulate(swap.value, requestedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toEqual({
      succeeded: true,
      contextSlot: 12346n,
      quoteFingerprint: quote.fingerprint,
    });
    expect(result.value.unitsConsumed).toBe(180000n);
    expect(result.value.evidence).toHaveLength(2);
    expect(Object.isFrozen(result.value.logs)).toBe(true);
  });

  it("returns explicit failed and unavailable simulation outcomes", async () => {
    const failed = fixture({
      simulation: { context: { slot: 12346 }, value: { err: { InstructionError: 1 } } },
    });
    const failedQuote = await accepted(failed.adapter);
    const failedSwap = await failed.adapter.construct({ quote: failedQuote, wallet, requestedAt });
    if (!failedSwap.ok) throw new Error(failedSwap.error.reason);
    const failedResult = await failed.adapter.simulate(failedSwap.value, requestedAt);
    expect(!failedResult.ok && failedResult.error.code).toBe("simulation_failed");

    const unavailable = fixture({ rejectSimulation: true });
    const unavailableQuote = await accepted(unavailable.adapter);
    const unavailableSwap = await unavailable.adapter.construct({
      quote: unavailableQuote,
      wallet,
      requestedAt,
    });
    if (!unavailableSwap.ok) throw new Error(unavailableSwap.error.reason);
    const unavailableResult = await unavailable.adapter.simulate(
      unavailableSwap.value,
      requestedAt,
    );
    expect(!unavailableResult.ok && unavailableResult.error.code).toBe("unavailable");
  });
});
