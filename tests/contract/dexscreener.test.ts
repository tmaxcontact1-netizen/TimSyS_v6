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
    priceChange: { m5: "-4.5" },
    txns: { m5: { buys: 12, sells: 3 } },
    volume: { m5: "1234.50" },
    liquidity: { usd: liquidity },
    fdv: "250000",
    marketCap: null,
    pairCreatedAt: 1_754_308_800_000,
  };
}

function adapter(status: number, body: unknown) {
  const calls: string[] = [];
  const http: JsonHttpClient = {
    get: async (url) => {
      calls.push(url);
      return { status, body, receivedAt };
    },
  };
  return { value: new DexScreenerMarketAdapter(http, identities), calls };
}

describe("DexScreener market observation contract", () => {
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
    expect(result.value.fiveMinutePriceChangePercentage?.toString()).toBe("-4.5");
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
