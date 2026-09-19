import { describe, expect, it } from "vitest";

import type { ObservationIdentityFactory } from "../../src/application/contracts/observations.js";
import {
  DexScreenerMarketAdapter,
  type JsonHttpClient,
} from "../../src/infrastructure/providers/dexscreener/adapter.js";
import { asTimestamp, asUuid, type EvidenceId } from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";

const mint = asMintAddress("So11111111111111111111111111111111111111112");
const receivedAt = asTimestamp("2026-08-04T12:00:01Z");
const identities: ObservationIdentityFactory = {
  createEvidenceId: () => asUuid<EvidenceId>("00000000-0000-4000-8000-000000000501"),
};

function pair(pairAddress: string, liquidity: string | null, chainId = "solana") {
  return {
    chainId,
    dexId: "raydium",
    pairAddress,
    baseToken: { address: mint },
    quoteToken: { address: "USDC111111111111111111111111111111111111111" },
    priceUsd: "0.025",
    priceChange: { m5: "-4.5", h1: "12.25" },
    txns: { m5: { buys: 12, sells: 3 } },
    volume: { m5: "1234.50", h1: "9876.50" },
    liquidity: { usd: liquidity },
    fdv: "250000",
    marketCap: null,
    pairCreatedAt: Date.parse("2026-08-01T00:00:00Z"),
  };
}

function adapter(status: number, body: unknown, bulkPairs: unknown = [pair("screened", "80000")]) {
  const calls: string[] = [];
  const http: JsonHttpClient = {
    get: async (url) => {
      calls.push(url);
      return {
        status,
        body: url.includes("/tokens/v1/")
          ? bulkPairs
          : url.includes("/latest/dex/search")
            ? { pairs: [] }
            : body,
        receivedAt,
      };
    },
  };
  return { value: new DexScreenerMarketAdapter(http, identities), calls };
}

describe("DexScreener market observation contract", () => {
  it("normalizes and deduplicates latest Solana token profiles", async () => {
    const fixture = adapter(200, [
      { chainId: "solana", tokenAddress: mint, url: `https://dexscreener.com/solana/${mint}` },
      { chainId: "ethereum", tokenAddress: "0xabc", url: "https://dexscreener.com/ethereum/0xabc" },
      { chainId: "solana", tokenAddress: mint, url: `https://dexscreener.com/solana/${mint}` },
    ]);
    const result = await fixture.value.discoverLatestTokens(asTimestamp("2026-08-04T12:00:00Z"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      mint,
      sourceReference: `https://dexscreener.com/solana/${mint}`,
      observedAt: receivedAt,
    });
    expect(result.value[0]?.trace.method).toBe("GET /token-profiles/latest/v1 + GET /tokens/v1/solana/{mints}");
    expect(fixture.calls[0]).toContain("/token-profiles/latest/v1");
    expect(fixture.calls).toEqual([
      "https://api.dexscreener.com/token-profiles/latest/v1",
      "https://api.dexscreener.com/token-boosts/latest/v1",
      "https://api.dexscreener.com/token-boosts/top/v1",
      "https://api.dexscreener.com/latest/dex/search?q=Raydium",
      "https://api.dexscreener.com/latest/dex/search?q=Meteora",
      "https://api.dexscreener.com/latest/dex/search?q=Orca",
      "https://api.dexscreener.com/latest/dex/search?q=pump",
      `https://api.dexscreener.com/tokens/v1/solana/${mint}`,
    ]);
  });

  it("widens discovery with liquid Raydium search results", async () => {
    const searchedMint = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const searchedPair = {
      ...pair("raydium-search-pair", "125000"),
      baseToken: { address: searchedMint },
      url: "https://dexscreener.com/solana/raydium-search-pair",
    };
    const calls: string[] = [];
    const http: JsonHttpClient = {
      get: async (url) => {
        calls.push(url);
        if (url.includes("/latest/dex/search"))
          return { status: 200, body: { pairs: [searchedPair] }, receivedAt };
        if (url.includes("/tokens/v1/"))
          return { status: 200, body: [searchedPair], receivedAt };
        return { status: 200, body: [], receivedAt };
      },
    };
    const result = await new DexScreenerMarketAdapter(http, identities).discoverLatestTokens(receivedAt);
    expect(result.ok && result.value.map((item) => item.mint)).toEqual([searchedMint]);
    expect(result.ok && result.value[0]?.trace.method).toContain("GET /latest/dex/search?q=Raydium");
    expect(calls.some((url) => url.includes("/latest/dex/search?q=Raydium"))).toBe(true);
  });

  it("does not queue promoted tokens that fail the existing liquidity floor", async () => {
    const fixture = adapter(200, [
      { chainId: "solana", tokenAddress: mint, url: `https://dexscreener.com/solana/${mint}` },
    ], [pair("thin", "50000")]);
    const result = await fixture.value.discoverLatestTokens(receivedAt);
    expect(result.ok && result.value).toEqual([]);
  });

  it("quarantines a malformed profile without suppressing valid Solana candidates", async () => {
    const fixture = adapter(200, [
      { chainId: "solana", tokenAddress: "not-a-mint", url: "https://dexscreener.com/solana/bad" },
      { chainId: "solana", tokenAddress: mint, url: `https://dexscreener.com/solana/${mint}` },
      { unexpected: true },
    ]);
    const result = await fixture.value.discoverLatestTokens(receivedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((item) => item.mint)).toEqual([mint]);
  });

  it("keeps healthy discovery feeds when another feed is unavailable", async () => {
    const http: JsonHttpClient = {
      get: async (url) => ({
        status: url.includes("token-profiles") ? 503 : 200,
        body: url.includes("/tokens/v1/") ? [pair("screened", "80000")] : url.includes("token-profiles")
          ? {}
          : [
              {
                chainId: "solana",
                tokenAddress: mint,
                url: `https://dexscreener.com/solana/${mint}`,
              },
            ],
        receivedAt,
      }),
    };
    const result = await new DexScreenerMarketAdapter(http, identities).discoverLatestTokens(
      receivedAt,
    );
    expect(result.ok && result.value.map((item) => item.mint)).toEqual([mint]);
  });

  it("reports rate limiting when no discovery feed succeeds", async () => {
    const fixture = adapter(429, {});
    const result = await fixture.value.discoverLatestTokens(receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("rate_limited");
  });

  it("selects the matching Solana pool by liquidity independent of response order", async () => {
    const first = adapter(200, {
      pairs: [
        pair("low", "50000"),
        pair("wrong-chain", "999999", "ethereum"),
        pair("high", "80000"),
      ],
    });
    const result = await first.value.observePrimaryPool(mint, asTimestamp("2026-08-04T12:00:00Z"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pairAddress).toBe("high");
    expect(result.value.liquidityUsd?.toString()).toBe("80000");
    expect(result.value.priceUsd?.toString()).toBe("0.025");
    expect(result.value.fiveMinutePriceChangePercentage?.toString()).toBe("-4.5");
    expect(result.value.oneHourPriceChangePercentage?.toString()).toBe("12.25");
    expect(result.value.oneHourVolumeUsd?.toString()).toBe("9876.5");
    expect(result.value.fiveMinuteBuys).toBe(12n);
    expect(result.value.trace).toMatchObject({
      provider: "dexscreener",
      requestedAt: "2026-08-04T12:00:00.000Z",
      respondedAt: "2026-08-04T12:00:01.000Z",
    });
    expect(result.value.trace.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.calls[0]).toContain(mint);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("uses pair address as the deterministic tie breaker", async () => {
    const fixture = adapter(200, { pairs: [pair("z-pool", "80000"), pair("a-pool", "80000")] });
    const result = await fixture.value.observePrimaryPool(mint, receivedAt);
    expect(result.ok && result.value.pairAddress).toBe("a-pool");
  });

  it.each([
    [429, { pairs: [] }, "rate_limited"],
    [200, { pairs: [] }, "not_indexed"],
    [200, { bad: true }, "malformed"],
    [200, { pairs: [pair("wrong", "10", "ethereum")] }, "contradictory"],
  ] as const)("returns explicit failure for status %s as %s", async (status, body, code) => {
    const fixture = adapter(status, body);
    const result = await fixture.value.observePrimaryPool(mint, receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });

  it("does not convert nullable market fields into zero", async () => {
    const fixture = adapter(200, { pairs: [pair("pool", null)] });
    const result = await fixture.value.observePrimaryPool(mint, receivedAt);
    expect(result.ok && result.value.liquidityUsd).toBeNull();
  });

  it("returns malformed for invalid decimal-safe values", async () => {
    const fixture = adapter(200, { pairs: [pair("pool", "not-a-number")] });
    const result = await fixture.value.observePrimaryPool(mint, receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("malformed");
  });
});
