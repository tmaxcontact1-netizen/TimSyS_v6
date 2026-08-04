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
  priceChange: z.object({ m5: nullableNumber }).optional(),
  txns: z
    .object({
      m5: z.object({ buys: z.number().int().nonnegative(), sells: z.number().int().nonnegative() }),
    })
    .optional(),
  volume: z.object({ m5: nullableNumber }).optional(),
  liquidity: z.object({ usd: nullableNumber }).optional(),
  fdv: nullableNumber,
  marketCap: nullableNumber,
  pairCreatedAt: z.number().int().nonnegative().nullable().optional(),
});
const responseSchema = z.object({ pairs: z.array(pairSchema).nullable() });
const profileSchema = z.object({
  chainId: z.string(),
  tokenAddress: z.string().min(1),
  url: z.string().url(),
});
const profilesSchema = z.array(profileSchema);
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
    let response: HttpResponse;
    try {
      response = await this.http.get(`${this.baseUrl}/token-profiles/latest/v1`);
    } catch {
      return failure("unavailable", requestedAt, "DexScreener discovery request failed", true);
    }
    if (response.status === 429)
      return failure("rate_limited", response.receivedAt, "DexScreener rate limit", true);
    if (response.status < 200 || response.status >= 300)
      return failure("unavailable", response.receivedAt, "DexScreener returned an error", true);
    const parsed = profilesSchema.safeParse(response.body);
    if (!parsed.success)
      return failure("malformed", response.receivedAt, "Malformed DexScreener profiles", false);
    const contentHash = hash(response.body);
    const observations: CandidateDiscoveryObservation[] = [];
    const seen = new Set<string>();
    for (const profile of parsed.data) {
      if (profile.chainId.toLowerCase() !== "solana" || seen.has(profile.tokenAddress)) continue;
      let mint: MintAddress;
      try {
        mint = asMintAddress(profile.tokenAddress);
      } catch {
        return failure("malformed", response.receivedAt, "Invalid DexScreener profile mint", false);
      }
      seen.add(profile.tokenAddress);
      const sourceKey = `dexscreener:token-profile:${profile.tokenAddress}:${profile.url}`;
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
            method: "GET /token-profiles/latest/v1",
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
    return Object.freeze({ ok: true, value: Object.freeze(observations) });
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
          trace,
        }),
      });
    } catch {
      return failure("malformed", response.receivedAt, "Invalid DexScreener numeric field", false);
    }
  }
}
