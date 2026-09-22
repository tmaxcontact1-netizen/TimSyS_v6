import { describe, expect, it } from "vitest";

import type { ObservationIdentityFactory } from "../../src/application/contracts/observations.js";
import { asTimestamp, asUuid, type EvidenceId } from "../../src/domain/shared/types.js";
import { GeckoTerminalMarketAdapter } from "../../src/infrastructure/providers/geckoterminal/adapter.js";
import type { JsonHttpClient } from "../../src/infrastructure/providers/dexscreener/adapter.js";

const receivedAt = asTimestamp("2026-09-19T12:00:00Z");
const mint = "So11111111111111111111111111111111111111112";
const identities: ObservationIdentityFactory = {
  createEvidenceId: () => asUuid<EvidenceId>("00000000-0000-4000-8000-000000000551"),
};

function pool(id: string) {
  return {
    id,
    attributes: {
      address: id,
      pool_created_at: "2026-09-18T12:00:00Z",
      reserve_in_usd: "125000",
      base_token_price_usd: "0.1",
      volume_usd: { m5: "5000", h1: "50000" },
      price_change_percentage: { m5: "1", h1: "5" },
      transactions: { m5: { buys: 20, sells: 10 } },
    },
    relationships: {
      base_token: { data: { id: `solana_${mint}` } },
      quote_token: { data: { id: "solana_USDC111111111111111111111111111111111111111" } },
      dex: { data: { id: "solana_raydium" } },
    },
  };
}

describe("GeckoTerminal discovery contract", () => {
  it("keeps each discovery cycle within one public request", async () => {
    const calls: string[] = [];
    const http: JsonHttpClient = {
      get: async (url) => {
        calls.push(url);
        return { status: 200, body: { data: [pool(`pool-${calls.length}`)] }, receivedAt };
      },
    };
    const result = await new GeckoTerminalMarketAdapter(http, identities).discoverLatestTokens(receivedAt);
    expect(result.ok && result.value).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls).toContain("https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1");
  });

  it("continues on the next page when an earlier page is unavailable", async () => {
    const http: JsonHttpClient = {
      get: async (url) => url.endsWith("page=1")
        ? { status: 503, body: {}, receivedAt }
        : { status: 200, body: { data: [pool("healthy-pool")] }, receivedAt },
    };
    const adapter = new GeckoTerminalMarketAdapter(http, identities);
    const unavailable = await adapter.discoverLatestTokens(receivedAt);
    expect(unavailable.ok).toBe(false);
    const healthy = await adapter.discoverLatestTokens(asTimestamp("2026-09-19T12:00:30Z"));
    expect(healthy.ok && healthy.value).toHaveLength(1);
  });

  it("rotates public discovery pages without increasing requests per cycle", async () => {
    const calls: string[] = [];
    const http: JsonHttpClient = {
      get: async (url) => {
        calls.push(url);
        return { status: 200, body: { data: [pool(`pool-${calls.length}`)] }, receivedAt };
      },
    };
    const adapter = new GeckoTerminalMarketAdapter(http, identities);
    await adapter.discoverLatestTokens(asTimestamp("2026-09-19T12:02:30Z"));
    expect(calls).toHaveLength(1);
    expect(calls).toContain("https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=6");
    calls.length = 0;
    await adapter.discoverLatestTokens(asTimestamp("2026-09-19T12:08:30Z"));
    expect(calls).toHaveLength(1);
    expect(calls).toContain("https://api.geckoterminal.com/api/v2/networks/solana/pools?page=3");
    calls.length = 0;
    await adapter.discoverLatestTokens(asTimestamp("2026-09-19T12:06:00Z"));
    expect(calls).toContain("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1&duration=1h");
  });
});
