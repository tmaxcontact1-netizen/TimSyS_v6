import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { ConfirmedMarketAdapter } from "../../src/infrastructure/providers/market-consensus/adapter.js";

const at = "2026-09-14T00:00:00.000Z" as never;
const mint = "11111111111111111111111111111111" as never;
const trace = (provider: "dexscreener" | "geckoterminal") => ({ evidenceId: `${provider}-evidence` as never, provider, method: "GET", requestedAt: at, respondedAt: at, sourceTimestamp: null, normalizedAt: at, sourceKey: provider, contentHash: provider });
const observation = (provider: "dexscreener" | "geckoterminal", price: string, liquidity: string) => ({ mint, poolId: `${provider}-pool` as never, pairAddress: `${provider}-pool`, dexId: "dex", baseMint: mint, quoteMint: "SOL", pairCreatedAt: null, priceUsd: new Decimal(price) as never, liquidityUsd: new Decimal(liquidity) as never, marketCapitalizationUsd: null, fullyDilutedValuationUsd: null, fiveMinuteVolumeUsd: null, fiveMinuteBuys: null, fiveMinuteSells: null, fiveMinutePriceChangePercentage: null, trace: trace(provider) });
const source = (value: ReturnType<typeof observation>) => ({ discoverLatestTokens: async () => ({ ok: true as const, value: [] }), observePrimaryPool: async () => ({ ok: true as const, value }) });

describe("independent market confirmation", () => {
  it("keeps both evidence traces and uses conservative liquidity", async () => {
    const adapter = new ConfirmedMarketAdapter(source(observation("dexscreener", "1", "100")), source(observation("geckoterminal", "1.05", "80")));
    const result = await adapter.observePrimaryPool(mint, at);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.traces).toHaveLength(2);
      expect(result.value.liquidityUsd?.toString()).toBe("80");
    }
  });

  it("rejects materially contradictory prices", async () => {
    const adapter = new ConfirmedMarketAdapter(source(observation("dexscreener", "1", "100")), source(observation("geckoterminal", "2", "100")));
    const result = await adapter.observePrimaryPool(mint, at);
    expect(result).toMatchObject({ ok: false, error: { code: "contradictory" } });
  });
});
