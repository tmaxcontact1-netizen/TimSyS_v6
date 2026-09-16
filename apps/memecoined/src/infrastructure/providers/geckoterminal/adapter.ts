import { createHash } from "node:crypto";
import { z } from "zod";

import type { ObservationIdentityFactory, ObservationResult, PoolMarketObservation } from "../../../application/contracts/observations.js";
import type { CandidateDiscoveryObservation, CandidateDiscoveryPort, MarketObservationPort } from "../../../application/ports/market.js";
import { asDecimal, asNonNegativeDecimal, asTimestamp, type MintAddress, type PoolId, type Timestamp } from "../../../domain/shared/types.js";
import { asMintAddress } from "../../../domain/token/token.js";
import type { JsonHttpClient } from "../dexscreener/adapter.js";

const relationship = z.object({ data: z.object({ id: z.string().min(1) }) });
const poolSchema = z.object({
  id: z.string().min(1),
  attributes: z.object({
    address: z.string().min(1),
    name: z.string().optional(),
    pool_created_at: z.string().datetime().nullable().optional(),
    base_token_price_usd: z.string().nullable().optional(),
    quote_token_price_usd: z.string().nullable().optional(),
    reserve_in_usd: z.string().nullable().optional(),
    fdv_usd: z.string().nullable().optional(),
    market_cap_usd: z.string().nullable().optional(),
    volume_usd: z.object({ m5: z.string().optional(), h1: z.string().optional() }).optional(),
    price_change_percentage: z.object({ m5: z.string().optional(), h1: z.string().optional() }).optional(),
    transactions: z.object({ m5: z.object({ buys: z.number().int().nonnegative(), sells: z.number().int().nonnegative() }) }).optional(),
  }),
  relationships: z.object({ base_token: relationship, quote_token: relationship, dex: relationship.optional() }),
});
const responseSchema = z.object({ data: z.array(poolSchema) });
type Pool = z.infer<typeof poolSchema>;

const token = (id: string) => id.startsWith("solana_") ? id.slice(7) : id;
const number = (value?: string | null) => value == null ? null : asNonNegativeDecimal(value);
const signed = (value?: string | null) => value == null ? null : asDecimal(value);
const reserve = (pool: Pool) => Number(pool.attributes.reserve_in_usd ?? -1);
const contentHash = (body: unknown) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

export class GeckoTerminalMarketAdapter implements MarketObservationPort, CandidateDiscoveryPort {
  public constructor(
    private readonly http: JsonHttpClient,
    private readonly identities: ObservationIdentityFactory,
    private readonly baseUrl = "https://api.geckoterminal.com/api/v2",
  ) {}

  private failure(at: Timestamp, reason: string, retryable = true): ObservationResult<never> {
    return Object.freeze({ ok: false, error: Object.freeze({ code: retryable ? "unavailable" : "not_indexed", provider: "geckoterminal" as const, occurredAt: at, retryable, reason }) });
  }

  public async discoverLatestTokens(requestedAt: Timestamp): Promise<ObservationResult<readonly CandidateDiscoveryObservation[]>> {
    let response;
    try { response = await this.http.get(`${this.baseUrl}/networks/solana/new_pools?page=1`); }
    catch { return this.failure(requestedAt, "GeckoTerminal discovery request failed"); }
    if (response.status === 429) return Object.freeze({ ok: false, error: Object.freeze({ code: "rate_limited" as const, provider: "geckoterminal" as const, occurredAt: response.receivedAt, retryable: true, reason: "GeckoTerminal rate limit" }) });
    const parsed = responseSchema.safeParse(response.body);
    if (!parsed.success) return this.failure(response.receivedAt, "Malformed GeckoTerminal discovery response");
    const hash = contentHash(response.body);
    const observations: CandidateDiscoveryObservation[] = [];
    const seen = new Set<string>();
    for (const pool of parsed.data.data) {
      const liquidity = reserve(pool);
      const createdAt = pool.attributes.pool_created_at;
      const ageMs = createdAt ? Date.parse(response.receivedAt) - Date.parse(createdAt) : NaN;
      if (!Number.isFinite(liquidity) || liquidity < 75_000 ||
          !Number.isFinite(ageMs) || ageMs < 30 * 60_000 || ageMs > 30 * 24 * 60 * 60_000)
        continue;
      const address = token(pool.relationships.base_token.data.id);
      if (seen.has(address)) continue;
      try {
        const mint = asMintAddress(address);
        seen.add(address);
        const sourceKey = `geckoterminal:new-pool:${pool.id}:${address}`;
        observations.push(Object.freeze({ mint, sourceReference: sourceKey, observedAt: response.receivedAt, trace: Object.freeze({
          evidenceId: this.identities.createEvidenceId({ provider: "geckoterminal", sourceKey, contentHash: hash }),
          provider: "geckoterminal", method: "GET /networks/solana/new_pools", requestedAt, respondedAt: response.receivedAt,
          sourceTimestamp: pool.attributes.pool_created_at ? asTimestamp(pool.attributes.pool_created_at) : null,
          normalizedAt: response.receivedAt, sourceKey, contentHash: hash,
        }) }));
      } catch { continue; }
    }
    return Object.freeze({ ok: true, value: Object.freeze(observations) });
  }

  public async observePrimaryPool(mint: MintAddress, requestedAt: Timestamp): Promise<ObservationResult<PoolMarketObservation>> {
    let response;
    try { response = await this.http.get(`${this.baseUrl}/networks/solana/tokens/${encodeURIComponent(mint)}/pools?page=1`); }
    catch { return this.failure(requestedAt, "GeckoTerminal market request failed"); }
    if (response.status === 429) return Object.freeze({ ok: false, error: Object.freeze({ code: "rate_limited" as const, provider: "geckoterminal" as const, occurredAt: response.receivedAt, retryable: true, reason: "GeckoTerminal rate limit" }) });
    const parsed = responseSchema.safeParse(response.body);
    if (!parsed.success) return this.failure(response.receivedAt, "Malformed GeckoTerminal market response");
    const pool = [...parsed.data.data].sort((a, b) => reserve(b) - reserve(a))[0];
    if (!pool) return this.failure(response.receivedAt, "Mint is not indexed by GeckoTerminal", false);
    const baseMint = token(pool.relationships.base_token.data.id);
    const quoteMint = token(pool.relationships.quote_token.data.id);
    const isBase = baseMint === mint;
    if (!isBase && quoteMint !== mint) return this.failure(response.receivedAt, "No matching Solana pool", false);
    const hash = contentHash(response.body);
    const sourceKey = `geckoterminal:token-pools:${mint}:${pool.attributes.address}`;
    const trace = Object.freeze({ evidenceId: this.identities.createEvidenceId({ provider: "geckoterminal", sourceKey, contentHash: hash }), provider: "geckoterminal" as const,
      method: "GET /networks/solana/tokens/{mint}/pools", requestedAt, respondedAt: response.receivedAt,
      sourceTimestamp: null, normalizedAt: response.receivedAt, sourceKey, contentHash: hash });
    try {
      return Object.freeze({ ok: true, value: Object.freeze({ mint, poolId: pool.attributes.address as PoolId, pairAddress: pool.attributes.address,
        dexId: pool.relationships.dex ? token(pool.relationships.dex.data.id) : "unknown", baseMint: mint,
        quoteMint: isBase ? quoteMint : baseMint, pairCreatedAt: pool.attributes.pool_created_at ? asTimestamp(pool.attributes.pool_created_at) : null,
        priceUsd: number(isBase ? pool.attributes.base_token_price_usd : pool.attributes.quote_token_price_usd), liquidityUsd: number(pool.attributes.reserve_in_usd),
        marketCapitalizationUsd: number(pool.attributes.market_cap_usd), fullyDilutedValuationUsd: number(pool.attributes.fdv_usd),
        fiveMinuteVolumeUsd: number(pool.attributes.volume_usd?.m5), fiveMinuteBuys: pool.attributes.transactions ? BigInt(pool.attributes.transactions.m5.buys) : null,
        fiveMinuteSells: pool.attributes.transactions ? BigInt(pool.attributes.transactions.m5.sells) : null,
        fiveMinutePriceChangePercentage: signed(pool.attributes.price_change_percentage?.m5), oneHourPriceChangePercentage: signed(pool.attributes.price_change_percentage?.h1),
        oneHourVolumeUsd: number(pool.attributes.volume_usd?.h1), trace, traces: Object.freeze([trace]) }) });
    } catch { return this.failure(response.receivedAt, "Invalid GeckoTerminal numeric field"); }
  }
}
