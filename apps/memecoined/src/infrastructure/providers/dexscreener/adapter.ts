import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  ObservationFailure,
  ObservationIdentityFactory,
  ObservationResult,
  ObservationTrace,
  PoolMarketObservation,
} from "../../../application/contracts/observations.js";
import type {
  CandidateDiscoveryObservation,
  CandidateDiscoveryPort,
  MarketObservationPort,
} from "../../../application/ports/market.js";
import { asDecimal, asNonNegativeDecimal, asTimestamp } from "../../../domain/shared/types.js";
import type { MintAddress, PoolId, Timestamp } from "../../../domain/shared/types.js";
import { asMintAddress } from "../../../domain/token/token.js";

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
  readonly receivedAt: Timestamp;
}

export interface JsonHttpClient {
  get(url: string): Promise<HttpResponse>;
}

const nullableNumber = z.union([z.number().finite(), z.string().min(1), z.null()]).optional();
const pairSchema = z.object({
  chainId: z.string(),
  dexId: z.string().min(1),
  pairAddress: z.string().min(1),
  baseToken: z.object({ address: z.string().min(1) }),
  quoteToken: z.object({ address: z.string().min(1) }),
  priceUsd: nullableNumber,
  priceChange: z.object({ m5: nullableNumber, h1: nullableNumber }).optional(),
  txns: z
    .object({
      m5: z.object({ buys: z.number().int().nonnegative(), sells: z.number().int().nonnegative() }),
    })
    .optional(),
  volume: z.object({ m5: nullableNumber, h1: nullableNumber }).optional(),
  liquidity: z.object({ usd: nullableNumber }).optional(),
  fdv: nullableNumber,
  marketCap: nullableNumber,
  pairCreatedAt: z.number().int().nonnegative().nullable().optional(),
  url: z.string().url().optional(),
});
const responseSchema = z.object({ pairs: z.array(pairSchema).nullable() });
const profileSchema = z.object({
  chainId: z.string(),
  tokenAddress: z.string().min(1),
  url: z.string().url(),
});
const profilesSchema = z.array(z.unknown());
const discoveryFeeds = Object.freeze([
  Object.freeze({ path: "/token-profiles/latest/v1", label: "token-profile" }),
  Object.freeze({ path: "/token-boosts/latest/v1", label: "latest-boost" }),
  Object.freeze({ path: "/token-boosts/top/v1", label: "top-boost" }),
]);
const discoverySearches = Object.freeze([
  Object.freeze({ query: "Raydium", label: "raydium-search" }),
  Object.freeze({ query: "Meteora", label: "meteora-search" }),
  Object.freeze({ query: "Orca", label: "orca-search" }),
  Object.freeze({ query: "pump", label: "pump-search" }),
  // Broad theme searches prevent the promotional feeds from collapsing the
  // paper-test universe to the same handful of boosted tokens.
  Object.freeze({ query: "Solana meme", label: "solana-meme-search" }),
  Object.freeze({ query: "AI", label: "ai-search" }),
  Object.freeze({ query: "cat", label: "cat-search" }),
  Object.freeze({ query: "dog", label: "dog-search" }),
]);
type Pair = z.infer<typeof pairSchema>;

function hash(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function failure(
  code: ObservationFailure["code"],
  occurredAt: Timestamp,
  reason: string,
  retryable: boolean,
): ObservationResult<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, provider: "dexscreener", occurredAt, retryable, reason }),
  });
}

function decimal(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : asNonNegativeDecimal(value);
}

function signedDecimal(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return asDecimal(value);
}

function liquidity(pair: Pair): number {
  const value = pair.liquidity?.usd;
  if (value === null || value === undefined) return -1;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -1;
}

function selectPool(pairs: readonly Pair[], mint: MintAddress): Pair | null {
  const eligible = pairs.filter(
    (pair) =>
      pair.chainId.toLowerCase() === "solana" &&
      (pair.baseToken.address === mint || pair.quoteToken.address === mint),
  );
  eligible.sort((left, right) => {
    const difference = liquidity(right) - liquidity(left);
    return difference === 0 ? left.pairAddress.localeCompare(right.pairAddress) : difference;
  });
  return eligible[0] ?? null;
}

export class DexScreenerMarketAdapter implements MarketObservationPort, CandidateDiscoveryPort {
  public constructor(
    private readonly http: JsonHttpClient,
    private readonly identities: ObservationIdentityFactory,
    private readonly baseUrl = "https://api.dexscreener.com",
  ) {}

  public async discoverLatestTokens(
    requestedAt: Timestamp,
  ): Promise<ObservationResult<readonly CandidateDiscoveryObservation[]>> {
    const settled = await Promise.allSettled(
      discoveryFeeds.map(async (feed) =>
        Object.freeze({ feed, response: await this.http.get(`${this.baseUrl}${feed.path}`) }),
      ),
    );
    const successful = settled.flatMap((item) => {
      if (item.status !== "fulfilled") return [];
      const { response } = item.value;
      const parsed = profilesSchema.safeParse(response.body);
      return response.status >= 200 && response.status < 300 && parsed.success
        ? [Object.freeze({ ...item.value, profiles: parsed.data })]
        : [];
    });
    if (successful.length === 0) {
      const responses = settled.flatMap((item) =>
        item.status === "fulfilled" ? [item.value.response] : [],
      );
      const lastAt =
        responses
          .map(({ receivedAt }) => receivedAt)
          .sort()
          .at(-1) ?? requestedAt;
      if (responses.some(({ status }) => status === 429))
        return failure(
          "rate_limited",
          lastAt,
          "DexScreener discovery feeds are rate limited",
          true,
        );
      if (
        responses.some(
          ({ status, body }) =>
            status >= 200 && status < 300 && !profilesSchema.safeParse(body).success,
        )
      )
        return failure("malformed", lastAt, "Malformed DexScreener discovery feed", false);
      return failure("unavailable", lastAt, "DexScreener discovery feeds are unavailable", true);
    }
    const observations: CandidateDiscoveryObservation[] = [];
    const seen = new Set<string>();
    for (const { feed, response, profiles } of successful) {
      const contentHash = hash(response.body);
      for (const rawProfile of profiles) {
        const candidate = profileSchema.safeParse(rawProfile);
        if (!candidate.success) continue;
        const profile = candidate.data;
        if (profile.chainId.toLowerCase() !== "solana" || seen.has(profile.tokenAddress)) continue;
        let mint: MintAddress;
        try {
          mint = asMintAddress(profile.tokenAddress);
        } catch {
          continue;
        }
        seen.add(profile.tokenAddress);
        const sourceKey = `dexscreener:${feed.label}:${profile.tokenAddress}:${profile.url}`;
        observations.push(
          Object.freeze({
            mint,
            sourceReference: profile.url,
            observedAt: response.receivedAt,
            trace: Object.freeze({
              evidenceId: this.identities.createEvidenceId({
                provider: "dexscreener",
                sourceKey,
                contentHash,
              }),
              provider: "dexscreener",
              method: `GET ${feed.path}`,
              requestedAt,
              respondedAt: response.receivedAt,
              sourceTimestamp: null,
              normalizedAt: response.receivedAt,
              sourceKey,
              contentHash,
            }),
          }),
        );
      }
    }
    // Promotional feeds are deliberately supplemented with a broad, public DEX
    // search. This prevents the paper engine from repeatedly assessing only the
    // same paid/promoted tokens while retaining the existing liquidity and age
    // admission checks below.
    const searchSettled = await Promise.allSettled(
      discoverySearches.map(async (search) =>
        Object.freeze({
          search,
          response: await this.http.get(
            `${this.baseUrl}/latest/dex/search?q=${encodeURIComponent(search.query)}`,
          ),
        }),
      ),
    );
    for (const result of searchSettled) {
      if (result.status !== "fulfilled") continue;
      const { search, response } = result.value;
      if (response.status < 200 || response.status >= 300) continue;
      const parsed = responseSchema.safeParse(response.body);
      if (!parsed.success || parsed.data.pairs === null) continue;
      const contentHash = hash(response.body);
      for (const pair of parsed.data.pairs) {
        if (pair.chainId.toLowerCase() !== "solana" || seen.has(pair.baseToken.address)) continue;
        let mint: MintAddress;
        try {
          mint = asMintAddress(pair.baseToken.address);
        } catch {
          continue;
        }
        seen.add(pair.baseToken.address);
        const sourceReference = pair.url ?? `https://dexscreener.com/solana/${pair.pairAddress}`;
        const sourceKey = `dexscreener:${search.label}:${pair.pairAddress}:${mint}`;
        observations.push(Object.freeze({
          mint,
          sourceReference,
          observedAt: response.receivedAt,
          trace: Object.freeze({
            evidenceId: this.identities.createEvidenceId({
              provider: "dexscreener",
              sourceKey,
              contentHash,
            }),
            provider: "dexscreener",
            method: `GET /latest/dex/search?q=${search.query}`,
            requestedAt,
            respondedAt: response.receivedAt,
            sourceTimestamp: null,
            normalizedAt: response.receivedAt,
            sourceKey,
            contentHash,
          }),
        }));
      }
    }
    if (observations.length === 0)
      return Object.freeze({ ok: true, value: Object.freeze([]) });
    const admitted: CandidateDiscoveryObservation[] = [];
    // The profile/boost feeds are promotional hints, not market-quality evidence.
    // One documented bulk request screens up to 30 mints before expensive RPC work.
    for (let offset = 0; offset < observations.length; offset += 30) {
      const batch = observations.slice(offset, offset + 30);
      let response: HttpResponse;
      try {
        response = await this.http.get(
          `${this.baseUrl}/tokens/v1/solana/${batch.map(({ mint }) => encodeURIComponent(mint)).join(",")}`,
        );
      } catch {
        return failure("unavailable", requestedAt, "DexScreener bulk pool screening failed", true);
      }
      if (response.status === 429)
        return failure("rate_limited", response.receivedAt, "DexScreener bulk pool screening is rate limited", true);
      if (response.status < 200 || response.status >= 300)
        return failure("unavailable", response.receivedAt, "DexScreener bulk pool screening is unavailable", true);
      const parsed = z.array(z.unknown()).safeParse(response.body);
      if (!parsed.success)
        return failure("malformed", response.receivedAt, "Malformed DexScreener bulk pool response", false);
      const pools = parsed.data.flatMap((value) => {
        const pair = pairSchema.safeParse(value);
        return pair.success ? [pair.data] : [];
      });
      for (const hint of batch) {
        const eligible = pools.some((pair) => {
          if (pair.chainId.toLowerCase() !== "solana" ||
              (pair.baseToken.address !== hint.mint && pair.quoteToken.address !== hint.mint)) return false;
          const usd = Number(pair.liquidity?.usd);
          const age = pair.pairCreatedAt === null || pair.pairCreatedAt === undefined
            ? NaN : Date.parse(response.receivedAt) - pair.pairCreatedAt;
          return Number.isFinite(usd) && usd >= 75_000 &&
            Number.isFinite(age) && age >= 30 * 60_000 && age <= 30 * 24 * 60 * 60_000;
        });
        if (!eligible) continue;
        const contentHash = hash([hint.trace.contentHash, response.body]);
        admitted.push(Object.freeze({ ...hint, observedAt: response.receivedAt,
          trace: Object.freeze({ ...hint.trace,
            evidenceId: this.identities.createEvidenceId({
              provider: "dexscreener", sourceKey: hint.trace.sourceKey, contentHash,
            }),
            method: `${hint.trace.method} + GET /tokens/v1/solana/{mints}`,
            respondedAt: response.receivedAt,
            normalizedAt: response.receivedAt,
            contentHash,
          }),
        }));
      }
    }
    return Object.freeze({ ok: true, value: Object.freeze(admitted) });
  }

  public async observePrimaryPool(
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<PoolMarketObservation>> {
    let response: HttpResponse;
    try {
      response = await this.http.get(
        `${this.baseUrl}/latest/dex/tokens/${encodeURIComponent(mint)}`,
      );
    } catch {
      return failure("unavailable", requestedAt, "DexScreener request failed", true);
    }
    if (response.status === 429)
      return failure("rate_limited", response.receivedAt, "DexScreener rate limit", true);
    if (response.status < 200 || response.status >= 300)
      return failure("unavailable", response.receivedAt, "DexScreener returned an error", true);

    const parsed = responseSchema.safeParse(response.body);
    if (!parsed.success)
      return failure("malformed", response.receivedAt, "Malformed DexScreener response", false);
    if (parsed.data.pairs === null || parsed.data.pairs.length === 0)
      return failure("not_indexed", response.receivedAt, "Mint is not indexed", false);
    const pair = selectPool(parsed.data.pairs, mint);
    if (pair === null)
      return failure("contradictory", response.receivedAt, "No matching Solana pool", false);

    const contentHash = hash(response.body);
    const sourceKey = `dexscreener:token-pairs:${mint}:${pair.pairAddress}`;
    const pairCreatedAt =
      pair.pairCreatedAt === null || pair.pairCreatedAt === undefined
        ? null
        : asTimestamp(new Date(pair.pairCreatedAt));
    const trace: ObservationTrace = Object.freeze({
      evidenceId: this.identities.createEvidenceId({
        provider: "dexscreener",
        sourceKey,
        contentHash,
      }),
      provider: "dexscreener",
      method: "GET /latest/dex/tokens/{mint}",
      requestedAt,
      respondedAt: response.receivedAt,
      sourceTimestamp: null,
      normalizedAt: response.receivedAt,
      sourceKey,
      contentHash,
    });
    const baseMint = (
      pair.baseToken.address === mint ? pair.baseToken.address : pair.quoteToken.address
    ) as MintAddress;
    try {
      return Object.freeze({
        ok: true,
        value: Object.freeze({
          mint,
          poolId: pair.pairAddress as PoolId,
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          baseMint,
          quoteMint:
            pair.baseToken.address === mint ? pair.quoteToken.address : pair.baseToken.address,
          pairCreatedAt,
          priceUsd: decimal(pair.priceUsd),
          liquidityUsd: decimal(pair.liquidity?.usd),
          marketCapitalizationUsd: decimal(pair.marketCap),
          fullyDilutedValuationUsd: decimal(pair.fdv),
          fiveMinuteVolumeUsd: decimal(pair.volume?.m5),
          fiveMinuteBuys: pair.txns === undefined ? null : BigInt(pair.txns.m5.buys),
          fiveMinuteSells: pair.txns === undefined ? null : BigInt(pair.txns.m5.sells),
          fiveMinutePriceChangePercentage: signedDecimal(pair.priceChange?.m5),
          oneHourPriceChangePercentage: signedDecimal(pair.priceChange?.h1),
          oneHourVolumeUsd: decimal(pair.volume?.h1),
          trace,
        }),
      });
    } catch {
      return failure("malformed", response.receivedAt, "Invalid DexScreener numeric field", false);
    }
  }
}
