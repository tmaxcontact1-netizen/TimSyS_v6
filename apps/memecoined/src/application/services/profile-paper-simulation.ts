import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import type { SwapPort } from "../ports/swap.js";
import type { MarketObservationPort } from "../ports/market.js";
import type { PoolMarketObservation } from "../contracts/observations.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";
import {
  asBasisPoints,
  asRawAmount,
  asTimestamp,
  asPercentage,
  type MintAddress,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import {
  tradingProfile,
  type PaperProfileMode,
  type TradingProfileDefinition,
  type TradingProfileId,
} from "../../domain/strategy/profiles.js";
import {
  evaluateShortHorizonSignal,
  type ExecutableMarketPoint,
} from "../../domain/strategy/short-horizon.js";
import type { TechnicalAnalysis } from "../../domain/strategy/technical-analysis.js";
import {
  calibrateProfile,
  evaluateAdaptiveEntry,
  type AdaptiveTradeCalibration,
} from "../../domain/strategy/adaptive-calibration.js";
import { scoreCandidate } from "../../domain/candidate/scoring.js";

export interface ProfileScoreBreakdown {
  readonly wallet: number;
  readonly liquidity: number;
  readonly momentum: number;
  readonly holders: number;
  readonly volumeQuality: number;
  readonly total: number;
}

export interface ProfileCandidateDecision {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

export interface ExecutableEntryEvidence {
  readonly observedAt: Timestamp;
  readonly inputAmountRaw: bigint;
  readonly outputAmountRaw: bigint;
  readonly liquidityUsd: number | null;
  readonly fiveMinuteVolumeUsd: number | null;
  readonly fiveMinuteBuys: bigint | null;
  readonly fiveMinuteSells: bigint | null;
}

// Authority, program, extension and direct-evidence checks are non-negotiable.
// Market appetite belongs to each paper profile; real execution retains its
// independent production entry gates.
const nonNegotiablePaperRuleIds = Object.freeze([
  "SEC-001",
  "SEC-002",
  "SEC-003",
  "SEC-004",
  "SEC-015",
]);
// Observation is not execution. Holder concentration remains a mandatory gate
// for the defensive profiles below, but must not prevent the faster paper
// profiles from collecting executable history before applying their own policy.
export const observationUniverseBlockingRuleIds = Object.freeze([
  "SEC-001",
  "SEC-002",
  "SEC-003",
  "SEC-004",
  "SEC-015",
]);
const strictPaperRuleIds = Object.freeze([
  ...nonNegotiablePaperRuleIds,
  "SEC-005",
  "SEC-006",
  "SEC-007",
  "SEC-008",
  "SEC-010",
  "SEC-012",
  "UNI-001",
  "UNI-002",
  "UNI-003",
  "UNI-004",
]);

function requiredPaperRules(profile: TradingProfileDefinition): ReadonlySet<string> {
  if (profile.id === "fast_furious")
    return new Set([
      ...nonNegotiablePaperRuleIds,
      "SEC-005",
      "SEC-006",
      "SEC-008",
      "SEC-010",
      "SEC-012",
    ]);
  if (profile.id === "scalper")
    return new Set([
      ...nonNegotiablePaperRuleIds,
      "SEC-005",
      "SEC-006",
      "SEC-008",
      "SEC-010",
      "SEC-012",
    ]);
  if (profile.id === "trend_detector")
    return new Set([
      ...nonNegotiablePaperRuleIds,
      "SEC-005",
      "SEC-006",
      "SEC-008",
      "SEC-010",
      "SEC-012",
    ]);
  if (profile.id === "liquidity_expansion")
    return new Set([...nonNegotiablePaperRuleIds, "SEC-005", "SEC-008", "SEC-010", "SEC-012"]);
  return new Set(strictPaperRuleIds);
}

/** Profile policy is deliberately deterministic and cannot override a failed safety gate. */
export function evaluateProfileCandidate(
  profile: TradingProfileDefinition,
  score: ProfileScoreBreakdown,
  failedSafetyRules: readonly string[],
  options: Readonly<{ adaptiveEntryConfirmed?: boolean }> = {},
): ProfileCandidateDecision {
  const reasons: string[] = [];
  if (profile.evidenceStatus === "awaiting_data")
    reasons.push(
      profile.evidenceMessage ?? "The evidence required by this profile is not connected yet",
    );
  const requiredRules = requiredPaperRules(profile);
  const applicableFailures = failedSafetyRules.filter((ruleId) => requiredRules.has(ruleId));
  if (applicableFailures.length)
    reasons.push(`Required gates failed: ${applicableFailures.join(", ")}`);
  if (!options.adaptiveEntryConfirmed && score.total < profile.minimumCandidateScore)
    reasons.push(
      `Score ${score.total} is below this profile's ${profile.minimumCandidateScore}-point threshold`,
    );
  if (profile.requiresWhaleConfirmation && score.wallet === 0)
    reasons.push("No qualifying tracked-wallet confirmation");
  if (!options.adaptiveEntryConfirmed && profile.id === "fast_furious" && (score.momentum < 12 || score.volumeQuality < 5))
    reasons.push("Short-term momentum and transaction quality do not agree");
  if (!options.adaptiveEntryConfirmed && profile.id === "trend_detector" && (score.momentum < 12 || score.liquidity < 10))
    reasons.push("Emerging trend lacks sufficient momentum or liquidity");
  if (profile.id === "whale_tracker" && (score.liquidity < 10 || score.volumeQuality < 5))
    reasons.push("Tracked-wallet activity lacks supporting liquidity or transaction quality");
  if (
    profile.id === "capital_preservation" &&
    (score.liquidity < 18 || score.holders < 10 || score.volumeQuality < 8)
  )
    reasons.push(
      "Liquidity, holder breadth or transaction quality is below the defensive standard",
    );
  if (
    !options.adaptiveEntryConfirmed && profile.id === "liquidity_expansion" &&
    (score.liquidity < 15 || score.volumeQuality < 8 || score.holders < 5)
  )
    reasons.push("Liquidity, transaction quality and holder breadth do not yet agree");
  if (
    !options.adaptiveEntryConfirmed && profile.id === "scalper" &&
    (score.momentum < 16 || score.volumeQuality < 10 || score.liquidity < 8)
  )
    reasons.push("Immediate momentum, liquidity and transaction quality do not yet agree");
  if (profile.id === "slow_steady" && (score.liquidity < 15 || score.holders < 8))
    reasons.push("Liquidity or holder distribution is below the long-hold standard");
  if (profile.id.startsWith("benchmark_") && (score.liquidity < 8 || score.volumeQuality < 4))
    reasons.push("The shared benchmark market-quality floor is not met");
  if (
    profile.id === "signal_consensus" &&
    [score.liquidity, score.momentum, score.holders, score.volumeQuality].some(
      (value) => value === 0,
    )
  )
    reasons.push("Liquidity, momentum, holders and transaction quality must all contribute");
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

interface CandidateRow {
  readonly candidate_id: string;
  readonly mint_address: string;
  readonly total_score: number;
  readonly breakdown_json: ProfileScoreBreakdown;
  readonly failed_rules: string[] | null;
  readonly evaluated_at: Date | string;
  readonly signal_json?: {
    readonly observedVolatilityBps?: number;
    readonly pattern?: string;
    readonly executableOutputAmountRaw?: string;
    readonly adaptiveCalibration?: AdaptiveTradeCalibration;
    readonly adaptiveEntryEligible?: boolean;
    readonly currentScore?: ProfileScoreBreakdown;
    readonly currentFailedRules?: readonly string[];
    readonly sourceScoreEvaluatedAt?: string;
    readonly technical?: TechnicalAnalysis;
  } | null;
}
interface ActivationRow {
  readonly profile_id: TradingProfileId;
  readonly mode: PaperProfileMode;
  readonly allocation_bps: number;
}
interface PositionRow {
  readonly profile_id: TradingProfileId;
  readonly token_mint: string;
  readonly candidate_id: string;
  readonly token_amount_raw: string;
  readonly cost_raw: string;
  readonly high_water_raw: string;
  readonly opened_at: Date | string;
  readonly entry_signal_json: {
    readonly observedVolatilityBps?: number;
    readonly adaptiveCalibration?: AdaptiveTradeCalibration;
  } | null;
  readonly engine_version: string;
}
interface PendingEntryRow extends CandidateRow {
  readonly profile_id: TradingProfileId;
  readonly entry_attempts: number;
  readonly signal_observed_at: Date | string | null;
}
type EntryAttempt =
  Readonly<{ outcome: "entered" }> | Readonly<{ outcome: "retry" | "failed"; reason: string }>;

const quoteSlippage = asBasisPoints(150n);
const observationInput = asRawAmount(10_000_000n);
const temporalEngineVersion = "temporal-v12";
export const fastObservationCohortSize = 12;
export const fastObservationDiscoverySlots = 4;
export const fastObservationTrackingUniverseSize = 24;

export function entryConfirmationPolicy(profileId: TradingProfileId): Readonly<{
  observations: number;
  minimumSpanSeconds: number;
}> {
  // The profile signal itself already requires time-spaced executable samples,
  // multi-bar coverage and independent market flow. Repeating a fleeting
  // pattern can consume the calibrated opportunity before any entry is quoted.
  void profileId;
  return Object.freeze({ observations: 1, minimumSpanSeconds: 0 });
}

export function minimumThesisMaturityMinutes(profileId: TradingProfileId): number {
  return profileId === "slow_steady" ? 30
    : profileId === "liquidity_expansion" ? 15
      : profileId === "trend_detector" ? 10
        : 0;
}
export function confirmedEntryLag(firstOutput: bigint, latestOutput: bigint, targetBps: number): Readonly<{
  eligible: boolean; moveBps: number;
}> {
  if (firstOutput <= 0n || latestOutput <= 0n || targetBps <= 0)
    return Object.freeze({ eligible: false, moveBps: 0 });
  const moveBps = Number((firstOutput * 10_000n) / latestOutput - 10_000n);
  return Object.freeze({ eligible: moveBps <= Math.max(50, targetBps * .5), moveBps });
}
const temporalProfileIds = new Set<TradingProfileId>([
  "fast_furious",
  "slow_steady",
  "scalper",
  "trend_detector",
  "capital_preservation",
  "signal_consensus",
  "breakout_retest",
  "liquidity_expansion",
  "recovery_reversal",
  "launch_transition",
  "benchmark_buy_hold",
  "benchmark_momentum",
  "benchmark_ema_cross",
  "benchmark_rsi_reversal",
  "benchmark_macd_trend",
  "benchmark_bollinger_reversion",
  "benchmark_donchian_breakout",
  "benchmark_volume_breakout",
  "benchmark_atr_trend",
]);
const iso = (value: Date | string): Timestamp => new Date(value).toISOString() as Timestamp;

/** Refresh volatile score components and their matching gates from one live market reading. */
export function refreshTemporalCandidateEvidence(input: {
  readonly previousScore: ProfileScoreBreakdown;
  readonly previousFailedRules: readonly string[];
  readonly scoreEvaluatedAt: Date | string;
  readonly observedAt: Timestamp;
  readonly market: PoolMarketObservation;
}): Readonly<{ score: ProfileScoreBreakdown; failedRules: readonly string[]; staticEvidenceFresh: boolean }> {
  const change = input.market.fiveMinutePriceChangePercentage;
  const live = scoreCandidate({
    walletConfirmation: "none",
    liquidityUsd: input.market.liquidityUsd,
    fiveMinutePriceChange: change !== null && change.gte(0) && change.lte(100)
      ? asPercentage(change.toString()) : null,
    topTenNormalPercentage: null,
    fiveMinuteBuyTransactions: input.market.fiveMinuteBuys,
    fiveMinuteSellTransactions: input.market.fiveMinuteSells,
  });
  const score = Object.freeze({
    wallet: input.previousScore.wallet,
    holders: input.previousScore.holders,
    liquidity: live.liquidity,
    momentum: live.momentum,
    volumeQuality: live.volumeQuality,
    total: input.previousScore.wallet + input.previousScore.holders + live.liquidity + live.momentum + live.volumeQuality,
  });
  const failed = new Set(input.previousFailedRules.filter((rule) =>
    rule !== "SEC-005" && rule !== "SEC-006" && rule !== "SEC-012"));
  if (input.market.liquidityUsd === null || input.market.liquidityUsd.lt(75_000)) failed.add("SEC-005");
  const poolAgeMinutes = input.market.pairCreatedAt === null
    ? NaN : (Date.parse(input.observedAt) - Date.parse(input.market.pairCreatedAt)) / 60_000;
  if (!Number.isFinite(poolAgeMinutes) || poolAgeMinutes < 30 || poolAgeMinutes > 43_200)
    failed.add("SEC-006");
  if (input.market.fiveMinuteBuys === null || input.market.fiveMinuteSells === null ||
      input.market.fiveMinuteSells > input.market.fiveMinuteBuys) failed.add("SEC-012");
  const staticAgeMs = Date.parse(input.observedAt) - new Date(input.scoreEvaluatedAt).getTime();
  return Object.freeze({
    score,
    failedRules: Object.freeze([...failed].sort()),
    staticEvidenceFresh: Number.isFinite(staticAgeMs) && staticAgeMs >= 0 && staticAgeMs <= 15 * 60_000,
  });
}

const shortHorizonProfiles = new Set<TradingProfileId>([
  "fast_furious",
  "scalper",
  "trend_detector",
  "breakout_retest",
  "liquidity_expansion",
  "recovery_reversal",
  "launch_transition",
]);

/**
 * Stop-loss sizing is unsafe for assets that can gap through the stop. This
 * absolute account cap bounds the damage even when executable liquidity
 * disappears between monitoring cycles.
 */
export function maximumPositionBps(profileId: TradingProfileId): bigint {
  if (profileId === "scalper" || profileId === "recovery_reversal") return 100n;
  if (shortHorizonProfiles.has(profileId)) return 150n;
  if (profileId.startsWith("benchmark_")) return 200n;
  return 250n;
}

/** Deterministic pre-entry checks against the executable quote and fresh market evidence. */
export function evaluateExecutableEntryEvidence(input: {
  readonly profile: TradingProfileDefinition;
  readonly proposedInputRaw: bigint;
  readonly proposedOutputRaw: bigint;
  readonly evidence: ExecutableEntryEvidence | null;
  readonly at: Timestamp;
}): ProfileCandidateDecision {
  if (!temporalProfileIds.has(input.profile.id))
    return Object.freeze({ eligible: true, reasons: Object.freeze([]) });
  const reasons: string[] = [];
  const evidence = input.evidence;
  if (!evidence) {
    reasons.push("No recent executable-market evidence is available");
    return Object.freeze({ eligible: false, reasons: Object.freeze(reasons) });
  }
  const ageMilliseconds = Date.parse(input.at) - Date.parse(evidence.observedAt);
  if (!Number.isFinite(ageMilliseconds) || ageMilliseconds < 0 || ageMilliseconds > 120_000)
    reasons.push("Executable-market evidence is more than two minutes old");

  const minimumLiquidityUsd =
    input.profile.id === "fast_furious" || input.profile.id === "scalper"
      ? 75_000
      : shortHorizonProfiles.has(input.profile.id)
        ? 50_000
        : 35_000;
  const minimumVolumeUsd =
    input.profile.id === "scalper"
      ? 10_000
      : shortHorizonProfiles.has(input.profile.id)
        ? 5_000
        : 2_500;
  if (evidence.liquidityUsd === null || evidence.liquidityUsd < minimumLiquidityUsd)
    reasons.push(`Pool liquidity is below $${minimumLiquidityUsd.toLocaleString()}`);
  if (evidence.fiveMinuteVolumeUsd === null || evidence.fiveMinuteVolumeUsd < minimumVolumeUsd)
    reasons.push(`Five-minute volume is below $${minimumVolumeUsd.toLocaleString()}`);

  if (
    evidence.fiveMinuteBuys !== null &&
    evidence.fiveMinuteSells !== null &&
    evidence.fiveMinuteBuys * 10n < evidence.fiveMinuteSells * 9n
  )
    reasons.push("Recent sells materially exceed buys");

  if (
    evidence.inputAmountRaw <= 0n ||
    evidence.outputAmountRaw <= 0n ||
    input.proposedInputRaw <= 0n ||
    input.proposedOutputRaw <= 0n
  ) {
    reasons.push("Executable quote evidence is incomplete");
  } else {
    const baseline = evidence.outputAmountRaw * input.proposedInputRaw;
    const proposed = input.proposedOutputRaw * evidence.inputAmountRaw;
    const impactBps = proposed >= baseline ? 0n : ((baseline - proposed) * 10_000n) / baseline;
    const maximumImpactBps =
      input.profile.id === "scalper"
        ? 75n
        : shortHorizonProfiles.has(input.profile.id)
          ? 125n
          : 175n;
    if (impactBps > maximumImpactBps)
      reasons.push(
        `Position-size price impact ${impactBps} bps exceeds the ${maximumImpactBps} bps limit`,
      );
  }
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

/** A trailing stop is profit protection, so it cannot activate before the trail is funded by a gain. */
export function trailingStopActivated(input: {
  readonly value: bigint;
  readonly cost: bigint;
  readonly high: bigint;
  readonly trailingBps: number;
}): boolean {
  const threshold = BigInt(10_000 + input.trailingBps);
  return (
    input.high * 10_000n >= input.cost * threshold &&
    input.value * 10_000n <= input.high * BigInt(10_000 - input.trailingBps)
  );
}

const uuid = (parts: readonly string[]) => {
  const hex = createHash("sha256").update(parts.join("\0")).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function ensureAccounts(pool: Pool, wallet: WalletAddress, at: Timestamp): Promise<void> {
  await pool.query(
    `INSERT INTO paper_profile_accounts
       (wallet,profile_id,allocation_bps,initial_cash_raw,cash_raw,created_at,updated_at)
     SELECT a.wallet,p.profile_id,p.allocation_bps,
            CASE WHEN p.profile_id LIKE 'benchmark_%' THEN a.initial_cash_raw
                 ELSE GREATEST(floor(a.initial_cash_raw*p.allocation_bps/10000),1) END,
            CASE WHEN p.profile_id LIKE 'benchmark_%' THEN a.initial_cash_raw
                 ELSE GREATEST(floor(a.initial_cash_raw*p.allocation_bps/10000),1) END,$2,$2
     FROM paper_accounts a JOIN paper_profile_activations p ON p.wallet=a.wallet
     WHERE a.wallet=$1 AND p.enabled=true AND p.mode='automatic_paper' AND p.allocation_bps>0
     ON CONFLICT (wallet,profile_id) DO NOTHING`,
    [wallet, at],
  );
}

interface FastObservationCandidate extends CandidateRow {}
interface FastObservationRow {
  readonly observed_at: Date | string;
  readonly output_amount_raw: string;
  readonly liquidity_usd: string | null;
  readonly five_minute_volume_usd: string | null;
  readonly five_minute_buys: string | null;
  readonly five_minute_sells: string | null;
}

interface EntryEvidenceRow {
  readonly observed_at: Date | string;
  readonly input_amount_raw: string;
  readonly output_amount_raw: string;
  readonly liquidity_usd: string | null;
  readonly five_minute_volume_usd: string | null;
  readonly five_minute_buys: string | null;
  readonly five_minute_sells: string | null;
}

async function collectFastMarketObservations(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  market: MarketObservationPort;
  wallet: WalletAddress;
  at: Timestamp;
}): Promise<void> {
  const enabled = await input.pool.query<{ profile_id: TradingProfileId }>(
    `SELECT profile_id FROM paper_profile_activations
      WHERE wallet=$1 AND enabled=true AND mode='automatic_paper' AND profile_id=ANY($2::text[])`,
    [input.wallet, [...temporalProfileIds]],
  );
  if (enabled.rows.length === 0) return;
  const candidates = await input.pool.query<FastObservationCandidate>(
    `WITH observation_history AS (
       SELECT token_mint,max(observed_at) AS last_observed
         FROM paper_fast_market_observations WHERE wallet=$1 GROUP BY token_mint
     ), latest AS (
       SELECT DISTINCT ON (c.mint_address) c.id::text AS candidate_id,c.mint_address,
              s.total_score,s.breakdown_json,s.evaluated_at,
              COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                         WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),'{}') AS failed_rules,
              h.last_observed
         FROM candidates c JOIN LATERAL
              (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
                WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
              LEFT JOIN observation_history h ON h.token_mint=c.mint_address
        WHERE s.total_score>=8 AND s.evaluated_at >= $2::timestamptz-interval '15 minutes'
        ORDER BY c.mint_address,s.evaluated_at DESC
     ), universe AS (
       -- Market points can improve; static authority and holder failures cannot.
       -- Spend bounded quote capacity on fresh, security-verified candidates.
       SELECT * FROM latest
        WHERE NOT (failed_rules && $3::text[])
     ), tracked_universe AS (
       -- Observation capacity is scarce: build dense time series for the best
       -- currently supported candidates first.  The hourly hash is only a
       -- deterministic tie-breaker; putting it first caused effectively random
       -- quiet tokens to consume the entire tracking cohort while stronger
       -- candidates never accumulated enough history to become tradeable.
       SELECT * FROM universe
        ORDER BY total_score DESC,evaluated_at DESC,
                 abs(hashtextextended(mint_address,
                   floor(extract(epoch FROM $2::timestamptz)/3600)::bigint))
        LIMIT $4
     ), incumbents AS (
       SELECT * FROM tracked_universe
        WHERE last_observed IS NULL OR last_observed <= $2::timestamptz-interval '30 seconds'
        ORDER BY last_observed ASC NULLS FIRST,total_score DESC
        LIMIT $5
     ), discoveries AS (
       -- Preserve explicit capacity for candidates not already in the cohort.
       SELECT u.* FROM universe u
        WHERE NOT EXISTS (SELECT 1 FROM tracked_universe i WHERE i.mint_address=u.mint_address)
          AND (u.last_observed IS NULL OR u.last_observed <= $2::timestamptz-interval '30 minutes')
        ORDER BY u.total_score DESC,u.evaluated_at DESC
        LIMIT $6
     ), selected AS (
       SELECT * FROM incumbents UNION ALL SELECT * FROM discoveries
     ), fillers AS (
       -- Fill unused discovery capacity from the tracked round-robin only.
       SELECT u.* FROM tracked_universe u
        WHERE NOT EXISTS (SELECT 1 FROM selected s WHERE s.mint_address=u.mint_address)
          AND (u.last_observed IS NULL OR u.last_observed <= $2::timestamptz-interval '30 seconds')
        ORDER BY COALESCE(u.last_observed,'epoch'::timestamptz),u.total_score DESC,u.evaluated_at DESC
        LIMIT GREATEST(0,16-(SELECT count(*) FROM selected))
     ) SELECT candidate_id,mint_address,total_score,breakdown_json,evaluated_at,failed_rules
         FROM (SELECT * FROM selected UNION ALL SELECT * FROM fillers) observation_batch
        ORDER BY CASE WHEN last_observed >= $2::timestamptz-interval '5 minutes' THEN 0 ELSE 1 END,
                 last_observed ASC NULLS FIRST,total_score DESC LIMIT 16`,
    [input.wallet, input.at, observationUniverseBlockingRuleIds, fastObservationTrackingUniverseSize,
     fastObservationCohortSize, fastObservationDiscoverySlots],
  );
  for (const candidate of candidates.rows) {
    const mint = candidate.mint_address as MintAddress;
    const [quote, market] = await Promise.all([
      input.swap.quote({
        inputMint: WRAPPED_SOL_MINT,
        outputMint: mint,
        inputAmount: observationInput,
        slippageBasisPoints: quoteSlippage,
        requestedAt: input.at,
      }),
      input.market.observePrimaryPool(mint, input.at),
    ]);
    if (!quote.ok || !market.ok) continue;
    const observation = market.value;
    await input.pool.query(
      `INSERT INTO paper_fast_market_observations
         (wallet,token_mint,observed_at,input_amount_raw,output_amount_raw,quote_fingerprint,
          market_price_usd,liquidity_usd,five_minute_volume_usd,five_minute_buys,
          five_minute_sells,five_minute_price_change,one_hour_price_change,market_evidence_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) ON CONFLICT DO NOTHING`,
      [
        input.wallet,
        candidate.mint_address,
        quote.value.receivedAt,
        quote.value.inputAmount.toString(),
        quote.value.expectedOutputAmount.toString(),
        quote.value.fingerprint,
        observation.priceUsd?.toString() ?? null,
        observation.liquidityUsd?.toString() ?? null,
        observation.fiveMinuteVolumeUsd?.toString() ?? null,
        observation.fiveMinuteBuys?.toString() ?? null,
        observation.fiveMinuteSells?.toString() ?? null,
        observation.fiveMinutePriceChangePercentage?.toString() ?? null,
        observation.oneHourPriceChangePercentage?.toString() ?? null,
        JSON.stringify(observation.traces ?? [observation.trace], (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ],
    );
    const history = await input.pool.query<FastObservationRow>(
      `WITH recent AS (
         SELECT observed_at,output_amount_raw,liquidity_usd,five_minute_volume_usd,
                five_minute_buys,five_minute_sells
           FROM paper_fast_market_observations
          WHERE wallet=$1 AND token_mint=$2 ORDER BY observed_at DESC LIMIT 40
       ), spaced AS (
         SELECT *,lag(observed_at) OVER (ORDER BY observed_at) AS previous_at FROM recent
       ), segmented AS (
         SELECT *,sum(CASE WHEN previous_at IS NOT NULL
                                AND observed_at-previous_at>interval '5 minutes'
                           THEN 1 ELSE 0 END)
                    OVER (ORDER BY observed_at) AS session_id
           FROM spaced
       ) SELECT observed_at,output_amount_raw::text,liquidity_usd::text,
                five_minute_volume_usd::text,five_minute_buys::text,five_minute_sells::text
           FROM segmented
          WHERE session_id=(SELECT max(session_id) FROM segmented)
          ORDER BY observed_at`,
      [input.wallet, candidate.mint_address],
    );
    const points: ExecutableMarketPoint[] = history.rows.map((row, index, rows) => ({
      observedAt: iso(row.observed_at),
      outputAmountRaw: BigInt(row.output_amount_raw),
      liquidityUsd: row.liquidity_usd,
      fiveMinuteVolumeUsd: row.five_minute_volume_usd,
      fiveMinuteBuys: row.five_minute_buys === null ? null : BigInt(row.five_minute_buys),
      fiveMinuteSells: row.five_minute_sells === null ? null : BigInt(row.five_minute_sells),
      ...(index === rows.length - 1
        ? { poolAgeMinutes: observation.pairCreatedAt === null ? null
            : Math.max(0, (Date.parse(input.at) - Date.parse(observation.pairCreatedAt)) / 60_000) }
        : {}),
    }));
    const current = refreshTemporalCandidateEvidence({
      previousScore: candidate.breakdown_json,
      previousFailedRules: candidate.failed_rules ?? [],
      scoreEvaluatedAt: candidate.evaluated_at,
      observedAt: input.at,
      market: observation,
    });
    for (const activation of enabled.rows) {
      const profile = tradingProfile(activation.profile_id);
      if (!profile) continue;
      const signal = evaluateShortHorizonSignal(profile.id, points);
      const adaptiveCalibration = calibrateProfile(profile.id, points, input.at);
      const adaptiveEntry = evaluateAdaptiveEntry(profile.id, signal, adaptiveCalibration);
      const profileDecision = evaluateProfileCandidate(
        profile,
        current.score,
        current.failedRules,
        { adaptiveEntryConfirmed: adaptiveEntry.eligible },
      );
      const eligible = adaptiveEntry.eligible && profileDecision.eligible && current.staticEvidenceFresh;
      const reasons = [adaptiveEntry.reason, ...profileDecision.reasons,
        ...(adaptiveCalibration ? [adaptiveCalibration.reason] : []),
        ...(!current.staticEvidenceFresh ? ["Token-security evidence is older than 15 minutes"] : [])];
      const signalEvidence = { ...signal,
        executableOutputAmountRaw: quote.value.expectedOutputAmount.toString(),
        adaptiveEntryEligible: adaptiveEntry.eligible,
        adaptiveEntryReason: adaptiveEntry.reason,
        ...(adaptiveCalibration ? { adaptiveCalibration } : {}), currentScore: current.score,
        currentFailedRules: current.failedRules,
        sourceScoreEvaluatedAt: iso(candidate.evaluated_at) };
      await input.pool.query(
        `INSERT INTO paper_fast_signal_events
           (wallet,profile_id,candidate_id,token_mint,observed_at,eligible,signal_json,reasons_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) ON CONFLICT DO NOTHING`,
        [
          input.wallet,
          profile.id,
          candidate.candidate_id,
          candidate.mint_address,
          input.at,
          eligible,
          JSON.stringify(signalEvidence),
          JSON.stringify(reasons),
        ],
      );
      await input.pool.query(
        `INSERT INTO paper_profile_candidate_decisions
         (wallet,profile_id,candidate_id,mode,eligible,score,reasons_json,evaluated_at,
            entry_state,next_entry_attempt_at,signal_json,signal_observed_at,engine_version)
         VALUES ($1,$2,$3,'automatic_paper',$4,$5,$6::jsonb,$7,
                 CASE WHEN $4 THEN 'pending' ELSE 'not_applicable' END,
                 CASE WHEN $4 THEN $7::timestamptz ELSE NULL END,$8::jsonb,$7,$9)
         ON CONFLICT (wallet,profile_id,candidate_id) DO UPDATE SET
           eligible=EXCLUDED.eligible,score=EXCLUDED.score,reasons_json=EXCLUDED.reasons_json,
           evaluated_at=EXCLUDED.evaluated_at,signal_json=EXCLUDED.signal_json,
           signal_observed_at=EXCLUDED.signal_observed_at,engine_version=EXCLUDED.engine_version,
           entry_state=CASE
             WHEN NOT EXCLUDED.eligible THEN 'not_applicable'
             WHEN paper_profile_candidate_decisions.entry_attempts>=5
               AND paper_profile_candidate_decisions.evaluated_at > $7::timestamptz-interval '10 minutes'
             THEN 'failed'
             WHEN paper_profile_candidate_decisions.entry_state IN ('pending','retrying') THEN paper_profile_candidate_decisions.entry_state
             WHEN EXCLUDED.eligible AND paper_profile_candidate_decisions.entry_state<>'entered'
               AND (paper_profile_candidate_decisions.entered_at IS NULL OR paper_profile_candidate_decisions.entered_at <= $7::timestamptz-interval '5 minutes')
             THEN 'pending' ELSE 'not_applicable' END,
           entry_attempts=CASE
             WHEN EXCLUDED.eligible AND paper_profile_candidate_decisions.entry_attempts>=5
               AND paper_profile_candidate_decisions.evaluated_at <= $7::timestamptz-interval '10 minutes'
             THEN 0 ELSE paper_profile_candidate_decisions.entry_attempts END,
           last_entry_error=CASE
             WHEN EXCLUDED.eligible AND paper_profile_candidate_decisions.entry_attempts>=5
               AND paper_profile_candidate_decisions.evaluated_at <= $7::timestamptz-interval '10 minutes'
             THEN NULL ELSE paper_profile_candidate_decisions.last_entry_error END,
           next_entry_attempt_at=CASE
             WHEN EXCLUDED.eligible AND (paper_profile_candidate_decisions.entry_attempts<5
               OR paper_profile_candidate_decisions.evaluated_at <= $7::timestamptz-interval '10 minutes')
               AND paper_profile_candidate_decisions.entry_state<>'entered'
             THEN $7::timestamptz ELSE NULL END`,
        [
          input.wallet,
          profile.id,
          candidate.candidate_id,
          eligible,
          current.score.total,
          JSON.stringify(reasons),
          input.at,
          JSON.stringify(signalEvidence),
          temporalEngineVersion,
        ],
      );
    }
  }
}

async function enterPosition(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  wallet: WalletAddress;
  profile: TradingProfileDefinition;
  candidate: CandidateRow;
  at: Timestamp;
  feeRaw: bigint;
}): Promise<EntryAttempt> {
  const lossCooldownMinutes = input.profile.id === "scalper" ? 15
    : input.profile.id === "fast_furious" ? 30
      : shortHorizonProfiles.has(input.profile.id) ? 120 : 360;
  const state = await input.pool.query<{
    cash_raw: string;
    initial_cash_raw: string;
    open_positions: string;
    recent_hard_stop: boolean;
  }>(
    `SELECT a.cash_raw::text,a.initial_cash_raw::text,
            (SELECT count(*) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id)::text AS open_positions,
            EXISTS (SELECT 1 FROM paper_profile_fills f
                     WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id
                       AND f.token_mint=$3 AND f.side='sell' AND f.reason='hard_stop'
                       AND f.filled_at >= $4::timestamptz-($5::text || ' minutes')::interval) AS recent_hard_stop
       FROM paper_profile_accounts a
      WHERE a.wallet=$1 AND a.profile_id=$2
        AND NOT EXISTS (SELECT 1 FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id AND p.token_mint=$3)`,
    [input.wallet, input.profile.id, input.candidate.mint_address, input.at, lossCooldownMinutes],
  );
  const row = state.rows[0];
  if (!row)
    return Object.freeze({ outcome: "retry", reason: "Position state changed before entry" });
  if (row.recent_hard_stop)
    return Object.freeze({
      outcome: "failed",
      reason: `Token is in this profile's ${lossCooldownMinutes}-minute loss cooldown after a hard-stop exit`,
    });
  const recentCrossProfileStop = await input.pool.query<{ stopped_at: Date }>(
    `SELECT filled_at AS stopped_at
       FROM paper_profile_fills
      WHERE wallet=$1 AND token_mint=$2 AND side='sell' AND reason='hard_stop'
        AND filled_at >= $3::timestamptz-interval '6 hours'
      ORDER BY filled_at DESC LIMIT 1`,
    [input.wallet, input.candidate.mint_address, input.at],
  );
  if (recentCrossProfileStop.rows[0]) {
    const technical = input.candidate.signal_json?.technical;
    const demonstrablyImproved = technical?.higherLows === true &&
      Number(technical.historyReturnBps ?? 0) > 0 &&
      Number(technical.qualityScore ?? 0) >= 75 &&
      Number(technical.efficiencyRatio ?? 0) >= 0.4 &&
      Number(technical.maximumDrawdownBps ?? Infinity) <= 500;
    if (!demonstrablyImproved)
      return Object.freeze({
        outcome: "failed",
        reason: "A recent hard stop remains negative evidence across strategies; the price structure has not demonstrably improved",
      });
  }
  if (Number(row.open_positions) >= input.profile.maximumConcurrentPositions)
    return Object.freeze({ outcome: "retry", reason: "Profile position limit is currently full" });
  const calibratedStopBps = input.candidate.signal_json?.adaptiveCalibration?.hardStopBps ??
    input.profile.hardStopBps;
  const riskSized =
    (BigInt(row.initial_cash_raw) * BigInt(input.profile.riskPerTradeBps)) /
    BigInt(calibratedStopBps);
  const absoluteCap =
    (BigInt(row.initial_cash_raw) * maximumPositionBps(input.profile.id)) / 10_000n;
  const available = BigInt(row.cash_raw) - input.feeRaw;
  const amount = [available, riskSized, absoluteCap].reduce((smallest, value) =>
    value < smallest ? value : smallest,
  );
  if (amount <= 0n)
    return Object.freeze({ outcome: "retry", reason: "Profile cash is currently unavailable" });
  const quoted = await input.swap.quote({
    inputMint: WRAPPED_SOL_MINT,
    outputMint: input.candidate.mint_address as MintAddress,
    inputAmount: asRawAmount(amount),
    slippageBasisPoints: quoteSlippage,
    requestedAt: input.at,
  });
  if (!quoted.ok)
    return Object.freeze({
      outcome: quoted.error.retryable ? "retry" : "failed",
      reason: `${quoted.error.provider}: ${quoted.error.reason}`,
    });
  const q = quoted.value;
  const evidenceResult = await input.pool.query<EntryEvidenceRow>(
    `SELECT observed_at,input_amount_raw::text,output_amount_raw::text,liquidity_usd::text,
            five_minute_volume_usd::text,five_minute_buys::text,five_minute_sells::text
       FROM paper_fast_market_observations
      WHERE wallet=$1 AND token_mint=$2 ORDER BY observed_at DESC LIMIT 1`,
    [input.wallet, input.candidate.mint_address],
  );
  const evidenceRow = evidenceResult.rows[0];
  const evidence = evidenceRow
    ? ({
        observedAt: iso(evidenceRow.observed_at),
        inputAmountRaw: BigInt(evidenceRow.input_amount_raw),
        outputAmountRaw: BigInt(evidenceRow.output_amount_raw),
        liquidityUsd: evidenceRow.liquidity_usd === null ? null : Number(evidenceRow.liquidity_usd),
        fiveMinuteVolumeUsd:
          evidenceRow.five_minute_volume_usd === null
            ? null
            : Number(evidenceRow.five_minute_volume_usd),
        fiveMinuteBuys:
          evidenceRow.five_minute_buys === null ? null : BigInt(evidenceRow.five_minute_buys),
        fiveMinuteSells:
          evidenceRow.five_minute_sells === null ? null : BigInt(evidenceRow.five_minute_sells),
      } satisfies ExecutableEntryEvidence)
    : null;
  const evidenceDecision = evaluateExecutableEntryEvidence({
    profile: input.profile,
    proposedInputRaw: BigInt(q.inputAmount),
    proposedOutputRaw: BigInt(q.expectedOutputAmount),
    evidence,
    at: q.receivedAt,
  });
  if (!evidenceDecision.eligible)
    return Object.freeze({ outcome: "failed", reason: evidenceDecision.reasons.join("; ") });
  const reverse = await input.swap.quote({
    inputMint: input.candidate.mint_address as MintAddress,
    outputMint: WRAPPED_SOL_MINT,
    inputAmount: q.expectedOutputAmount,
    slippageBasisPoints: quoteSlippage,
    requestedAt: q.receivedAt,
  });
  if (!reverse.ok)
    return Object.freeze({
      outcome: reverse.error.retryable ? "retry" : "failed",
      reason: `Round-trip cost check failed: ${reverse.error.reason}`,
    });
  const immediateReturn = BigInt(reverse.value.expectedOutputAmount);
  const roundTripLossBps =
    immediateReturn >= BigInt(q.inputAmount)
      ? 0n
      : ((BigInt(q.inputAmount) - immediateReturn) * 10_000n) / BigInt(q.inputAmount);
  const maximumFrictionBps = input.candidate.signal_json?.adaptiveCalibration
    ? BigInt(input.candidate.signal_json.adaptiveCalibration.maximumRoundTripCostBps)
    : input.profile.id === "scalper" ? 100n : 200n;
  if (roundTripLossBps > maximumFrictionBps)
    return Object.freeze({
      outcome: "failed",
      reason: `Executable round-trip cost ${roundTripLossBps} bps exceeds this profile's ${maximumFrictionBps} bps limit`,
    });
  // The provider receives the quote after the simulation cycle begins. Use that
  // later timestamp for the audited fill so filled_at can never precede quoted_at.
  const filledAt = q.receivedAt;
  const entered = await transaction(input.pool, async (client) => {
    const debit = await client.query(
      `UPDATE paper_profile_accounts
          SET cash_raw=cash_raw-$3::numeric-$4::numeric,updated_at=$5
        WHERE wallet=$1 AND profile_id=$2
          AND cash_raw >= $3::numeric+$4::numeric`,
      [input.wallet, input.profile.id, q.inputAmount.toString(), input.feeRaw.toString(), filledAt],
    );
    if (debit.rowCount !== 1) return false;
    const inserted = await client.query(
      `INSERT INTO paper_profile_positions
       (wallet,profile_id,token_mint,candidate_id,token_amount_raw,cost_raw,current_value_raw,high_water_raw,entry_signal_json,engine_version,opened_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$7::jsonb,$8,$9,$9) ON CONFLICT DO NOTHING`,
      [
        input.wallet,
        input.profile.id,
        input.candidate.mint_address,
        input.candidate.candidate_id,
        q.expectedOutputAmount.toString(),
        q.inputAmount.toString(),
        JSON.stringify(input.candidate.signal_json ?? null),
        temporalEngineVersion,
        filledAt,
      ],
    );
    if (inserted.rowCount !== 1) throw new Error("Profile position changed during entry");
    await client.query(
      `INSERT INTO paper_profile_fills
       (id,wallet,profile_id,candidate_id,side,token_mint,token_amount_raw,settlement_amount_raw,execution_fee_raw,quote_fingerprint,reason,engine_version,quoted_at,filled_at)
       VALUES ($1,$2,$3,$4,'buy',$5,$6,$7,$8,$9,'profile_entry',$10,$11,$12)`,
      [
        uuid([input.wallet, input.profile.id, "buy", q.fingerprint]),
        input.wallet,
        input.profile.id,
        input.candidate.candidate_id,
        input.candidate.mint_address,
        q.expectedOutputAmount.toString(),
        q.inputAmount.toString(),
        input.feeRaw.toString(),
        q.fingerprint,
        temporalEngineVersion,
        q.receivedAt,
        filledAt,
      ],
    );
    return true;
  });
  return entered
    ? Object.freeze({ outcome: "entered" })
    : Object.freeze({ outcome: "retry", reason: "Profile funds changed before entry" });
}

async function processPendingEntries(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  wallet: WalletAddress;
  at: Timestamp;
  feeRaw: bigint;
}): Promise<void> {
  const due = await input.pool.query<PendingEntryRow>(
    `SELECT d.profile_id,d.entry_attempts,d.signal_json,d.signal_observed_at,c.id::text AS candidate_id,c.mint_address,
            s.total_score,s.breakdown_json,s.evaluated_at,
            COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                       WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),'{}') AS failed_rules
       FROM paper_profile_candidate_decisions d
       JOIN candidates c ON c.id=d.candidate_id
       JOIN LATERAL (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
                      WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
      WHERE d.wallet=$1 AND d.eligible=true AND d.mode='automatic_paper'
        AND d.entry_state IN ('pending','retrying') AND d.entry_attempts < 5
        AND d.next_entry_attempt_at <= $2
      ORDER BY row_number() OVER (
                 PARTITION BY d.profile_id
                 ORDER BY CASE WHEN d.entry_state='pending' THEN 0 ELSE 1 END,
                          d.signal_observed_at DESC NULLS LAST,d.next_entry_attempt_at,c.id),
               CASE WHEN d.profile_id LIKE 'benchmark_%' THEN 1 ELSE 0 END,
               d.signal_observed_at DESC NULLS LAST,d.profile_id,c.id
      LIMIT 40`,
    [input.wallet, input.at],
  );
  for (const candidate of due.rows) {
    const profile = tradingProfile(candidate.profile_id);
    if (!profile) continue;
    const scoreAgeMs = Date.parse(input.at) - new Date(candidate.evaluated_at).getTime();
    const signalAgeMs = candidate.signal_observed_at === null
      ? Infinity : Date.parse(input.at) - new Date(candidate.signal_observed_at).getTime();
    if (!Number.isFinite(scoreAgeMs) || scoreAgeMs < 0 || scoreAgeMs > 15 * 60_000 ||
        (temporalProfileIds.has(profile.id) &&
         (!Number.isFinite(signalAgeMs) || signalAgeMs < 0 || signalAgeMs > 2 * 60_000))) {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET eligible=false,entry_state='failed',last_entry_error='Entry evidence expired before execution',next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, candidate.candidate_id],
      );
      continue;
    }
    const signalEvidence = candidate.signal_json;
    const sourceScoreMatches = signalEvidence?.sourceScoreEvaluatedAt !== undefined &&
      Date.parse(signalEvidence.sourceScoreEvaluatedAt) === new Date(candidate.evaluated_at).getTime();
    if (temporalProfileIds.has(profile.id) &&
        (!sourceScoreMatches || signalEvidence?.currentScore === undefined ||
         signalEvidence.currentFailedRules === undefined)) {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET eligible=false,entry_state='failed',last_entry_error='Current market evidence is missing or superseded',next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, candidate.candidate_id],
      );
      continue;
    }
    const currentDecision = evaluateProfileCandidate(
      profile,
      temporalProfileIds.has(profile.id) ? signalEvidence!.currentScore! : candidate.breakdown_json,
      temporalProfileIds.has(profile.id) ? signalEvidence!.currentFailedRules! : candidate.failed_rules ?? [],
      { adaptiveEntryConfirmed: signalEvidence?.adaptiveEntryEligible === true },
    );
    if (!currentDecision.eligible) {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET eligible=false,entry_state='failed',last_entry_error=$4,next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, candidate.candidate_id, currentDecision.reasons.join("; ")],
      );
      continue;
    }
    const confirmationPolicy = entryConfirmationPolicy(profile.id);
    if (confirmationPolicy.observations > 1) {
      const confirmations = await input.pool.query<{
        confirmations: string; span_seconds: string | null;
        first_output_raw: string | null; last_output_raw: string | null;
      }>(
        `SELECT count(*)::text AS confirmations,
                extract(epoch FROM (max(observed_at)-min(observed_at)))::text AS span_seconds,
                (array_agg(output_raw ORDER BY observed_at))[1] AS first_output_raw,
                (array_agg(output_raw ORDER BY observed_at DESC))[1] AS last_output_raw
           FROM (SELECT observed_at,signal_json->>'executableOutputAmountRaw' AS output_raw
                   FROM paper_fast_signal_events
                  WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3 AND eligible=true
                    AND signal_json->>'pattern'=$4
                    AND signal_json->>'executableOutputAmountRaw' IS NOT NULL
                    AND observed_at >= $5::timestamptz-interval '10 minutes'
                  ORDER BY observed_at DESC LIMIT $6) confirmed`,
        [
          input.wallet,
          profile.id,
          candidate.mint_address,
          signalEvidence?.pattern ?? "none",
          input.at,
          confirmationPolicy.observations,
        ],
      );
      const confirmation = confirmations.rows[0];
      const count = Number(confirmation?.confirmations ?? 0);
      const spanSeconds = Number(confirmation?.span_seconds ?? 0);
      if (count < confirmationPolicy.observations || spanSeconds < confirmationPolicy.minimumSpanSeconds) {
        const nextAt = asTimestamp(new Date(Date.parse(input.at) + 20_000));
        await input.pool.query(
          `UPDATE paper_profile_candidate_decisions
              SET entry_state='retrying',last_entry_error=$4,next_entry_attempt_at=$5
            WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
          [
            input.wallet,
            profile.id,
            candidate.candidate_id,
            `Waiting for ${confirmationPolicy.observations} matching observations across ${confirmationPolicy.minimumSpanSeconds} seconds`,
            nextAt,
          ],
        );
        continue;
      }
      const firstOutput = BigInt(confirmation?.first_output_raw ?? "0");
      const lastOutput = BigInt(confirmation?.last_output_raw ?? "0");
      const adaptiveTargetBps = signalEvidence?.adaptiveCalibration?.targetBps ?? 0;
      const entryLag = confirmedEntryLag(firstOutput, lastOutput, adaptiveTargetBps);
      if (!entryLag.eligible) {
        await input.pool.query(
          `UPDATE paper_profile_candidate_decisions
              SET eligible=false,entry_state='failed',last_entry_error=$4,next_entry_attempt_at=NULL
            WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
          [input.wallet, profile.id, candidate.candidate_id,
            `Entry arrived ${entryLag.moveBps} bps after the first confirmed signal, beyond half its calibrated target`],
        );
        continue;
      }
    }
    const attempt = await enterPosition({ ...input, profile, candidate });
    const attempts = candidate.entry_attempts + 1;
    if (attempt.outcome === "entered") {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET entry_state='entered',entry_attempts=$4,last_entry_error=NULL,
                next_entry_attempt_at=NULL,entered_at=$3
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$5`,
        [input.wallet, profile.id, input.at, attempts, candidate.candidate_id],
      );
      continue;
    }
    const terminal = attempt.outcome === "failed" || attempts >= 5;
    const delaySeconds = Math.min(15 * 2 ** Math.max(attempts - 1, 0), 300);
    const nextAt = asTimestamp(new Date(Date.parse(input.at) + delaySeconds * 1000));
    await input.pool.query(
      `UPDATE paper_profile_candidate_decisions
          SET entry_state=$4,entry_attempts=$5,last_entry_error=$6,
              next_entry_attempt_at=$7
        WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
      [
        input.wallet,
        profile.id,
        candidate.candidate_id,
        terminal ? "failed" : "retrying",
        attempts,
        attempt.reason,
        terminal ? null : nextAt,
      ],
    );
  }
}

async function evaluateNewCandidates(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  wallet: WalletAddress;
  at: Timestamp;
  feeRaw: bigint;
}): Promise<void> {
  const activations = await input.pool.query<ActivationRow>(
    `SELECT profile_id,mode,allocation_bps FROM paper_profile_activations WHERE wallet=$1 AND enabled=true ORDER BY profile_id`,
    [input.wallet],
  );
  const candidates = await input.pool.query<CandidateRow>(
    `SELECT c.id::text AS candidate_id,c.mint_address,s.total_score,s.breakdown_json,
            COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                      WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),
                     '{}') AS failed_rules,
            s.evaluated_at
       FROM candidates c JOIN LATERAL
            (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
              WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
      WHERE EXISTS (SELECT 1 FROM paper_profile_activations a WHERE a.wallet=$1 AND a.enabled=true)
        AND EXISTS (SELECT 1 FROM paper_profile_activations a WHERE a.wallet=$1 AND a.enabled=true
                    AND NOT EXISTS (SELECT 1 FROM paper_profile_candidate_decisions d
                                    WHERE d.wallet=$1 AND d.profile_id=a.profile_id AND d.candidate_id=c.id))
      ORDER BY s.evaluated_at,c.id LIMIT 30`,
    [input.wallet],
  );
  for (const candidate of candidates.rows) {
    for (const activation of activations.rows) {
      const profile = tradingProfile(activation.profile_id);
      if (!profile) continue;
      if (temporalProfileIds.has(profile.id)) continue;
      const decision = evaluateProfileCandidate(
        profile,
        candidate.breakdown_json,
        candidate.failed_rules ?? [],
      );
      await input.pool.query(
        `INSERT INTO paper_profile_candidate_decisions
         (wallet,profile_id,candidate_id,mode,eligible,score,reasons_json,evaluated_at,
          entry_state,next_entry_attempt_at,engine_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,
                 CASE WHEN $5=true AND $4='automatic_paper' THEN 'pending' ELSE 'not_applicable' END,
                 CASE WHEN $5=true AND $4='automatic_paper' THEN $8::timestamptz ELSE NULL::timestamptz END,
                 'temporal-v5')
         ON CONFLICT DO NOTHING`,
        [
          input.wallet,
          profile.id,
          candidate.candidate_id,
          activation.mode,
          decision.eligible,
          candidate.total_score,
          JSON.stringify(decision.reasons),
          input.at,
        ],
      );
    }
  }
}

async function monitorPositions(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  wallet: WalletAddress;
  at: Timestamp;
  feeRaw: bigint;
}): Promise<void> {
  const result = await input.pool.query<PositionRow>(
    `SELECT profile_id,token_mint,candidate_id,token_amount_raw::text,cost_raw::text,high_water_raw::text,entry_signal_json,engine_version,opened_at
       FROM paper_profile_positions WHERE wallet=$1 ORDER BY profile_id,opened_at LIMIT 50`,
    [input.wallet],
  );
  for (const position of result.rows) {
    const profile = tradingProfile(position.profile_id);
    if (!profile) continue;
    const quoted = await input.swap.quote({
      inputMint: position.token_mint as MintAddress,
      outputMint: WRAPPED_SOL_MINT,
      inputAmount: asRawAmount(BigInt(position.token_amount_raw)),
      slippageBasisPoints: quoteSlippage,
      requestedAt: input.at,
    });
    if (!quoted.ok) continue;
    const q = quoted.value,
      value = q.expectedOutputAmount,
      cost = BigInt(position.cost_raw),
      high = BigInt(position.high_water_raw);
    const ageMinutes = (Date.parse(input.at) - Date.parse(iso(position.opened_at))) / 60000;
    const observedVolatility = Math.max(
      0,
      Number(position.entry_signal_json?.observedVolatilityBps ?? 0),
    );
    const calibration = position.entry_signal_json?.adaptiveCalibration;
    const adaptiveStopBps = calibration
      ? calibration.hardStopBps
      : observedVolatility
      ? Math.min(
          profile.hardStopBps,
          Math.max(Math.round(observedVolatility * 1.25), Math.round(profile.hardStopBps / 2)),
        )
      : profile.hardStopBps;
    const adaptiveTargetBps = calibration
      ? calibration.targetBps
      : observedVolatility
      ? Math.min(
          profile.firstProfitTargetBps,
          Math.max(
            Math.round(observedVolatility * 1.75),
            Math.round(profile.firstProfitTargetBps / 2),
          ),
        )
      : profile.firstProfitTargetBps;
    const adaptiveTrailingBps = calibration
      ? calibration.trailingStopBps
      : observedVolatility
      ? Math.min(
          profile.trailingStopBps,
          Math.max(Math.round(observedVolatility), Math.round(profile.trailingStopBps / 2)),
        )
      : profile.trailingStopBps;
    const stop = value * 10000n <= cost * BigInt(10000 - adaptiveStopBps);
    const thesisMature = ageMinutes >= minimumThesisMaturityMinutes(profile.id);
    const target = thesisMature && value * 10000n >= cost * BigInt(10000 + adaptiveTargetBps);
    const trailingActivationBps = calibration?.trailingActivationBps ?? adaptiveTrailingBps;
    const trailing = thesisMature && high * 10_000n >= cost * BigInt(10_000 + trailingActivationBps) &&
      value * 10_000n <= high * BigInt(10_000 - adaptiveTrailingBps);
    const timeout = ageMinutes >= (calibration?.maximumHoldingMinutes ?? profile.maximumHoldingMinutes);
    if (!stop && !target && !trailing && !timeout) {
      await input.pool.query(
        `UPDATE paper_profile_positions SET current_value_raw=$4,high_water_raw=GREATEST(high_water_raw,$4),updated_at=$5 WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3`,
        [input.wallet, profile.id, position.token_mint, value.toString(), input.at],
      );
      continue;
    }
    const reason = stop
      ? "hard_stop"
      : target
        ? "profit_target"
        : trailing
          ? "trailing_stop"
          : "time_limit";
    // As with entries, the quote is received after the cycle timestamp. Keep
    // the fill audit chronologically valid when an exit condition fires.
    const filledAt = q.receivedAt;
    await transaction(input.pool, async (client) => {
      const removed = await client.query(
        `DELETE FROM paper_profile_positions WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3 RETURNING token_amount_raw`,
        [input.wallet, profile.id, position.token_mint],
      );
      if (removed.rowCount !== 1) return;
      const net = value > input.feeRaw ? value - input.feeRaw : 0n;
      await client.query(
        `UPDATE paper_profile_accounts
            SET cash_raw=cash_raw+$3::numeric,
                realized_pnl_raw=realized_pnl_raw+($4::numeric-$5::numeric-$6::numeric),
                updated_at=$7
          WHERE wallet=$1 AND profile_id=$2`,
        [
          input.wallet,
          profile.id,
          net.toString(),
          value.toString(),
          cost.toString(),
          input.feeRaw.toString(),
          filledAt,
        ],
      );
      await client.query(
        `INSERT INTO paper_profile_fills
         (id,wallet,profile_id,candidate_id,side,token_mint,token_amount_raw,settlement_amount_raw,execution_fee_raw,quote_fingerprint,reason,engine_version,quoted_at,filled_at)
         VALUES ($1,$2,$3,$4,'sell',$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          uuid([input.wallet, profile.id, "sell", q.fingerprint]),
          input.wallet,
          profile.id,
          position.candidate_id,
          position.token_mint,
          position.token_amount_raw,
          value.toString(),
          input.feeRaw.toString(),
          q.fingerprint,
          reason,
          position.engine_version,
          q.receivedAt,
          filledAt,
        ],
      );
      await client.query(
        `UPDATE paper_profile_candidate_decisions
            SET entry_state='not_applicable',next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, position.candidate_id],
      );
    });
  }
}

interface DueShadowObservationRow {
  readonly exit_fill_id: string;
  readonly profile_id: TradingProfileId;
  readonly token_mint: string;
  readonly token_amount_raw: string;
  readonly exit_reason: string;
  readonly exit_at: Date | string;
  readonly entry_cost_raw: string;
  readonly exit_value_raw: string;
  readonly horizon_minutes: number;
  readonly target_bps: number | null;
  readonly stop_bps: number | null;
}

/**
 * Continues pricing closed positions at fixed horizons. This makes stop-loss
 * review falsifiable: the dashboard can distinguish a correct stop from an
 * early entry or a stop that was too close to normal volatility.
 */
async function collectPostExitShadowObservations(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  wallet: WalletAddress;
  at: Timestamp;
}): Promise<void> {
  const due = await input.pool.query<DueShadowObservationRow>(
    `WITH horizons(minutes) AS (VALUES (5),(15),(30),(60),(180)), exits AS (
       SELECT f.id::text AS exit_fill_id,f.profile_id,f.token_mint,
              f.token_amount_raw::text,f.reason AS exit_reason,f.filled_at AS exit_at,
              f.settlement_amount_raw::text AS exit_value_raw,
              entry.settlement_amount_raw::text AS entry_cost_raw,
              NULLIF(d.signal_json->'adaptiveCalibration'->>'targetBps','')::int AS target_bps,
              NULLIF(d.signal_json->'adaptiveCalibration'->>'hardStopBps','')::int AS stop_bps
         FROM paper_profile_fills f
         JOIN LATERAL (
           SELECT b.settlement_amount_raw FROM paper_profile_fills b
            WHERE b.wallet=f.wallet AND b.profile_id=f.profile_id
              AND b.token_mint=f.token_mint AND b.side='buy'
              AND (b.filled_at,b.id)<(f.filled_at,f.id)
            ORDER BY b.filled_at DESC,b.id DESC LIMIT 1
         ) entry ON true
         LEFT JOIN paper_profile_candidate_decisions d
           ON d.wallet=f.wallet AND d.profile_id=f.profile_id AND d.candidate_id=f.candidate_id
        WHERE f.wallet=$1 AND f.side='sell' AND f.engine_version=$2
          AND f.filled_at >= $3::timestamptz-interval '4 hours'
     )
     SELECT e.*,h.minutes AS horizon_minutes FROM exits e CROSS JOIN horizons h
      WHERE e.exit_at+h.minutes*interval '1 minute' <= $3
        AND NOT EXISTS (SELECT 1 FROM paper_profile_post_exit_observations o
                         WHERE o.wallet=$1 AND o.exit_fill_id=e.exit_fill_id::uuid
                           AND o.horizon_minutes=h.minutes)
      ORDER BY e.exit_at,h.minutes LIMIT 16`,
    [input.wallet, temporalEngineVersion, input.at],
  );
  for (const row of due.rows) {
    const quote = await input.swap.quote({
      inputMint: row.token_mint as MintAddress,
      outputMint: WRAPPED_SOL_MINT,
      inputAmount: asRawAmount(BigInt(row.token_amount_raw)),
      slippageBasisPoints: quoteSlippage,
      requestedAt: input.at,
    });
    if (!quote.ok) continue;
    await input.pool.query(
      `INSERT INTO paper_profile_post_exit_observations
       (wallet,exit_fill_id,profile_id,token_mint,exit_reason,exit_at,horizon_minutes,
        observed_at,entry_cost_raw,exit_value_raw,observed_value_raw,target_bps,stop_bps,quote_fingerprint)
       VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`,
      [input.wallet,row.exit_fill_id,row.profile_id,row.token_mint,row.exit_reason,iso(row.exit_at),
       row.horizon_minutes,quote.value.receivedAt,row.entry_cost_raw,row.exit_value_raw,
       quote.value.expectedOutputAmount.toString(),row.target_bps,row.stop_bps,quote.value.fingerprint],
    );
  }
}

/** Runs attributable profile decisions and independent simulated sub-portfolios using executable quotes. */
export async function runProfilePaperSimulationCycle(input: {
  readonly database: Pool;
  readonly swap: Pick<SwapPort, "quote">;
  readonly market: MarketObservationPort;
  readonly wallet: WalletAddress;
  readonly now: () => Timestamp;
  readonly executionFeeRaw: bigint;
}): Promise<void> {
  const at = input.now();
  await ensureAccounts(input.database, input.wallet, at);
  await collectFastMarketObservations({
    pool: input.database,
    swap: input.swap,
    market: input.market,
    wallet: input.wallet,
    at,
  });
  await evaluateNewCandidates({
    pool: input.database,
    swap: input.swap,
    wallet: input.wallet,
    at,
    feeRaw: input.executionFeeRaw,
  });
  await processPendingEntries({
    pool: input.database,
    swap: input.swap,
    wallet: input.wallet,
    at,
    feeRaw: input.executionFeeRaw,
  });
  await monitorPositions({
    pool: input.database,
    swap: input.swap,
    wallet: input.wallet,
    at,
    feeRaw: input.executionFeeRaw,
  });
  await collectPostExitShadowObservations({
    pool: input.database,
    swap: input.swap,
    wallet: input.wallet,
    at,
  });
}

export async function readProfilePostExitAnalysis(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
) {
  const result = await database.query(
    `WITH exits AS (
       SELECT wallet,exit_fill_id,profile_id,token_mint,exit_reason,exit_at,
              max(entry_cost_raw)::numeric AS entry_cost_raw,
              max(exit_value_raw)::numeric AS exit_value_raw,
              max(target_bps) AS target_bps,max(stop_bps) AS stop_bps,
              max(observed_value_raw) AS best_after_exit_raw,
              min(observed_value_raw) AS worst_after_exit_raw,
              max(observed_value_raw) FILTER (WHERE horizon_minutes=5) AS value_5m_raw,
              max(observed_value_raw) FILTER (WHERE horizon_minutes=15) AS value_15m_raw,
              max(observed_value_raw) FILTER (WHERE horizon_minutes=30) AS value_30m_raw,
              max(observed_value_raw) FILTER (WHERE horizon_minutes=60) AS value_60m_raw,
              max(observed_value_raw) FILTER (WHERE horizon_minutes=180) AS value_180m_raw,
              count(*)::int AS horizons_observed
         FROM paper_profile_post_exit_observations WHERE wallet=$1
        GROUP BY wallet,exit_fill_id,profile_id,token_mint,exit_reason,exit_at
     ) SELECT *,
       (best_after_exit_raw>exit_value_raw) AS bounced,
       (best_after_exit_raw>=entry_cost_raw) AS recovered_entry,
       (target_bps IS NOT NULL AND best_after_exit_raw*10000>=entry_cost_raw*(10000+target_bps)) AS reached_original_target,
       round(((best_after_exit_raw-exit_value_raw)*10000/NULLIF(exit_value_raw,0))::numeric,2)::text AS best_rebound_bps,
       CASE WHEN best_after_exit_raw>=entry_cost_raw THEN 'premature_stop'
            WHEN best_after_exit_raw>exit_value_raw THEN 'partial_rebound'
            WHEN worst_after_exit_raw<exit_value_raw THEN 'correct_rejection'
            ELSE 'inconclusive' END AS classification
       FROM exits ORDER BY exit_at DESC LIMIT 250`,
    [wallet],
  );
  return result.rows;
}

export async function readProfilePaperPerformance(
  database: Pick<Pool, "query">,
  wallet: WalletAddress,
) {
  const result = await database.query(
    `SELECT a.profile_id,a.initial_cash_raw::text,a.cash_raw::text,a.realized_pnl_raw::text,
            COALESCE((SELECT sum(p.cost_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id),0)::text AS open_cost_raw,
            COALESCE((SELECT sum(p.current_value_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id),0)::text AS open_value_raw,
            (a.cash_raw+COALESCE((SELECT sum(p.current_value_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id),0)-a.initial_cash_raw)::text AS net_pnl_raw,
            (SELECT count(*) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id)::int AS open_positions,
            (SELECT count(*) FROM paper_profile_fills f WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id AND f.engine_version=$2)::int AS fills,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.engine_version=$2)::int AS candidates_evaluated,
            (SELECT count(DISTINCT c.mint_address) FROM paper_profile_candidate_decisions d JOIN candidates c ON c.id=d.candidate_id WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.engine_version=$2)::int AS unique_tokens_evaluated,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.engine_version=$2 AND d.eligible)::int AS candidates_qualified,
            (COALESCE((SELECT sum(CASE WHEN f.side='buy' THEN -f.settlement_amount_raw-f.execution_fee_raw ELSE f.settlement_amount_raw-f.execution_fee_raw END) FROM paper_profile_fills f WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id AND f.engine_version=$2),0)
             +COALESCE((SELECT sum(p.current_value_raw) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id AND p.engine_version=$2),0))::text AS current_engine_net_pnl_raw,
            (SELECT count(*) FROM paper_profile_fills f WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id)::int AS lifetime_fills,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id)::int AS lifetime_candidates_evaluated
            ,(SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.entry_state IN ('pending','retrying') AND d.entry_attempts<5 AND d.next_entry_attempt_at IS NOT NULL)::int AS entries_pending
            ,(SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.entry_state='failed')::int AS entries_failed
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id)::int AS short_horizon_signals
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id AND e.eligible)::int AS short_horizon_qualified
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id AND e.signal_json ? 'adaptiveCalibration')::int AS adaptive_calibrations
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id AND e.signal_json->'adaptiveCalibration'->>'tradeable'='true')::int AS adaptive_tradeable
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id AND e.signal_json->'adaptiveCalibration'->>'tradeable'='true' AND e.signal_json->>'adaptiveEntryEligible'='false')::int AS adaptive_pattern_waiting
            ,(SELECT e.signal_json FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id ORDER BY e.observed_at DESC LIMIT 1) AS latest_signal
            ,(SELECT e.observed_at FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id ORDER BY e.observed_at DESC LIMIT 1) AS latest_signal_at
            ,(SELECT count(*) FROM paper_fast_market_observations o WHERE o.wallet=a.wallet)::int AS market_observations
            ,(SELECT count(DISTINCT o.token_mint) FROM paper_fast_market_observations o WHERE o.wallet=a.wallet)::int AS monitored_tokens
            ,(SELECT count(*) FROM (
                 SELECT o.token_mint FROM paper_fast_market_observations o
                  WHERE o.wallet=a.wallet GROUP BY o.token_mint HAVING count(*)>=6
              ) ready)::int AS history_ready_tokens
       FROM paper_profile_accounts a WHERE a.wallet=$1 ORDER BY a.profile_id`,
    [wallet, temporalEngineVersion],
  );
  return result.rows;
}
