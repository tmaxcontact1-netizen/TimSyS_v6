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
import { evaluateOscillation } from "../../domain/strategy/oscillation.js";
import { assessFastFuriousRegime } from "../../domain/strategy/fast-furious-regime.js";
import { SignalGateCounter } from "../../domain/strategy/signal-gate-counter.js";
import { ObservationAttemptExecutor } from "../../workers/observation-attempt-executor.js";

export const profileSignalGateCounter = new SignalGateCounter();
export const observationWatchSlotOrderSql =
  "watch_score DESC,qualified_at DESC,mint_address";

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
  if (profile.id === "fast_furious" || profile.id === "oscillation_trader")
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
  if (
    !options.adaptiveEntryConfirmed &&
    profile.id === "fast_furious" &&
    (score.momentum < 12 || score.volumeQuality < 5)
  )
    reasons.push("Short-term momentum and transaction quality do not agree");
  if (
    !options.adaptiveEntryConfirmed &&
    profile.id === "trend_detector" &&
    (score.momentum < 12 || score.liquidity < 10)
  )
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
    !options.adaptiveEntryConfirmed &&
    profile.id === "liquidity_expansion" &&
    (score.liquidity < 15 || score.volumeQuality < 8 || score.holders < 5)
  )
    reasons.push("Liquidity, transaction quality and holder breadth do not yet agree");
  if (
    !options.adaptiveEntryConfirmed &&
    profile.id === "scalper" &&
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
    readonly oscillation?: ReturnType<typeof evaluateOscillation>;
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
  readonly entry_fee_raw: string;
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
  readonly signal_id: string | null;
}
type EntryAttempt =
  | Readonly<{ outcome: "entered"; fillId: string }>
  | Readonly<{ outcome: "retry" | "failed"; reason: string }>;

const quoteSlippage = asBasisPoints(150n);
const observationInput = asRawAmount(10_000_000n);
const temporalEngineVersion = "temporal-v17-regime-watch";
export const fastObservationCohortSize = 8;
export const fastObservationDiscoverySlots = 8;
export const fastObservationTrackingUniverseSize = 64;
export const oscillationObservationCohortSize = 8;
export const oscillationObservationDiscoverySlots = 8;
export const oscillationObservationTrackingUniverseSize = 64;
export const observationConcurrency = 16;

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
  return profileId === "slow_steady"
    ? 30
    : profileId === "liquidity_expansion"
      ? 15
      : profileId === "trend_detector"
        ? 10
        : 0;
}
export function confirmedEntryLag(
  firstOutput: bigint,
  latestOutput: bigint,
  targetBps: number,
): Readonly<{
  eligible: boolean;
  moveBps: number;
}> {
  if (firstOutput <= 0n || latestOutput <= 0n || targetBps <= 0)
    return Object.freeze({ eligible: false, moveBps: 0 });
  const moveBps = Number((firstOutput * 10_000n) / latestOutput - 10_000n);
  return Object.freeze({ eligible: moveBps <= Math.max(50, targetBps * 0.5), moveBps });
}
const temporalProfileIds = new Set<TradingProfileId>([
  "fast_furious",
  "slow_steady",
  "scalper",
  "oscillation_trader",
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
}): Readonly<{
  score: ProfileScoreBreakdown;
  failedRules: readonly string[];
  staticEvidenceFresh: boolean;
}> {
  const change = input.market.fiveMinutePriceChangePercentage;
  const live = scoreCandidate({
    walletConfirmation: "none",
    liquidityUsd: input.market.liquidityUsd,
    fiveMinutePriceChange:
      change !== null && change.gte(0) && change.lte(100) ? asPercentage(change.toString()) : null,
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
    total:
      input.previousScore.wallet +
      input.previousScore.holders +
      live.liquidity +
      live.momentum +
      live.volumeQuality,
  });
  const failed = new Set(
    input.previousFailedRules.filter(
      (rule) => rule !== "SEC-005" && rule !== "SEC-006" && rule !== "SEC-012",
    ),
  );
  if (input.market.liquidityUsd === null || input.market.liquidityUsd.lt(75_000))
    failed.add("SEC-005");
  const poolAgeMinutes =
    input.market.pairCreatedAt === null
      ? NaN
      : (Date.parse(input.observedAt) - Date.parse(input.market.pairCreatedAt)) / 60_000;
  if (!Number.isFinite(poolAgeMinutes) || poolAgeMinutes < 30 || poolAgeMinutes > 43_200)
    failed.add("SEC-006");
  if (
    input.market.fiveMinuteBuys === null ||
    input.market.fiveMinuteSells === null ||
    input.market.fiveMinuteSells > input.market.fiveMinuteBuys
  )
    failed.add("SEC-012");
  const staticAgeMs = Date.parse(input.observedAt) - new Date(input.scoreEvaluatedAt).getTime();
  return Object.freeze({
    score,
    failedRules: Object.freeze([...failed].sort()),
    staticEvidenceFresh:
      Number.isFinite(staticAgeMs) && staticAgeMs >= 0 && staticAgeMs <= 15 * 60_000,
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
  "oscillation_trader",
]);

/**
 * Stop-loss sizing is unsafe for assets that can gap through the stop. This
 * absolute account cap bounds the damage even when executable liquidity
 * disappears between monitoring cycles.
 */
export function maximumPositionBps(profileId: TradingProfileId): bigint {
  if (profileId === "oscillation_trader") return 125n;
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
  // Absolute volume floors contradicted otherwise executable signals: a small
  // position in a $75k liquid pool could pass live price-impact and round-trip
  // checks yet be rejected solely because five-minute turnover was <$5k. Scale
  // the activity floor to the pool while retaining a meaningful lower bound;
  // the fresh sized quote and reverse quote remain the final economic gates.
  if (evidence.liquidityUsd === null || evidence.liquidityUsd < minimumLiquidityUsd)
    reasons.push(`Pool liquidity is below $${minimumLiquidityUsd.toLocaleString()}`);
  // Turnover is discovery evidence, not execution authority. A fixed or
  // liquidity-scaled volume floor rejected live, profitable opportunities even
  // when the sized quote, reverse quote, pool liquidity and price impact proved
  // the proposed paper position executable. Those economic checks below are
  // the authoritative gate; missing activity data is still rejected earlier by
  // the profile's market-confirmation policy.

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

interface FastObservationCandidate extends CandidateRow {
  readonly watched_profiles: readonly TradingProfileId[] | null;
  readonly observation_cohort: "watch" | "ot_probe" | "rotating";
}
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

type InstrumentedProviderResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: string;
        provider: string;
        occurredAt: Timestamp;
        retryable: boolean;
        httpStatus?: number;
        failureKind?: string;
      }>;
    }>;

async function runInstrumentedProviderCall<Value>(input: {
  pool: Pool;
  attemptId: string;
  provider: string;
  operation: string;
  invoke: () => Promise<InstrumentedProviderResult<Value>>;
}): Promise<InstrumentedProviderResult<Value>> {
  let last: InstrumentedProviderResult<Value>;
  for (let tryNumber = 1; tryNumber <= 2; tryNumber += 1) {
    const started = new Date();
    last = await input.invoke();
    const completed = new Date();
    const retryable = !last.ok && last.error.retryable;
    const retryScheduled = retryable && tryNumber === 1;
    const outcome = last.ok
      ? "success"
      : (last.error.failureKind ??
        (last.error.code === "rate_limited"
          ? "rate_limited"
          : last.error.code === "validation"
            ? "validation_error"
            : "transport_error"));
    await input.pool.query(
      `INSERT INTO paper_observation_provider_calls
         (id,observation_attempt_id,epoch_id,provider,operation,try_number,started_at,
          completed_at,latency_ms,outcome,http_status,error_code,retryable,retry_scheduled,
          retry_delay_ms,response_received_at)
       VALUES($1,$2,current_paper_validation_epoch_id(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        uuid([input.attemptId, input.provider, input.operation, String(tryNumber)]),
        input.attemptId,
        input.provider,
        input.operation,
        tryNumber,
        started,
        completed,
        Math.max(0, completed.getTime() - started.getTime()),
        outcome,
        last.ok ? null : (last.error.httpStatus ?? null),
        last.ok ? null : last.error.code,
        retryable,
        retryScheduled,
        retryScheduled ? 1000 : null,
        last.ok ? completed : last.error.occurredAt,
      ],
    );
    if (!retryScheduled) return last;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return last!;
}

async function updateRegimeWatch(input: {
  pool: Pool;
  wallet: WalletAddress;
  profileId: TradingProfileId;
  mint: MintAddress;
  at: Timestamp;
  score: number;
  qualified: boolean;
  evaluable: boolean;
}): Promise<void> {
  // Missing or stale sampling evidence is not a market vote. Preserve an
  // existing qualification streak until a sufficiently sampled evaluation can
  // confirm or reject the regime.
  if (!input.evaluable) {
    await input.pool.query(
      `UPDATE paper_profile_regime_watches SET last_evaluated_at=$4,updated_at=$4
        WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3 AND status='active'`,
      [input.wallet, input.profileId, input.mint, input.at],
    );
    return;
  }
  if (input.qualified) {
    await input.pool.query(
      `INSERT INTO paper_profile_regime_watches
         (wallet,profile_id,token_mint,qualified_at,last_evaluated_at,regime_score,
          consecutive_qualifications,below_floor_cycles,pinned,status,updated_at)
       VALUES ($1,$2,$3,$4,$4,$5,1,0,false,'active',$4)
       ON CONFLICT (wallet,profile_id,token_mint) DO UPDATE SET
         last_evaluated_at=EXCLUDED.last_evaluated_at,regime_score=EXCLUDED.regime_score,
         consecutive_qualifications=paper_profile_regime_watches.consecutive_qualifications+1,
         below_floor_cycles=0,status='active',updated_at=EXCLUDED.updated_at,
         pinned=paper_profile_regime_watches.pinned OR
                paper_profile_regime_watches.consecutive_qualifications+1>=5`,
      [
        input.wallet,
        input.profileId,
        input.mint,
        input.at,
        Math.max(0, Math.min(100, input.score)),
      ],
    );
    return;
  }
  await input.pool.query(
    `UPDATE paper_profile_regime_watches SET
       last_evaluated_at=$4,regime_score=GREATEST(0,regime_score-1),
       consecutive_qualifications=0,
       below_floor_cycles=CASE WHEN $5<45 THEN below_floor_cycles+1 ELSE 0 END,
       status=CASE WHEN $5<45 AND below_floor_cycles+1>=3
                         AND $4::timestamptz-qualified_at>=interval '10 minutes'
                   THEN 'removed' ELSE status END,
       pinned=CASE WHEN $5<45 AND below_floor_cycles+1>=3
                        AND $4::timestamptz-qualified_at>=interval '10 minutes'
                   THEN false ELSE pinned END,updated_at=$4
     WHERE wallet=$1 AND profile_id=$2 AND token_mint=$3 AND status='active'`,
    [input.wallet, input.profileId, input.mint, input.at, Math.max(0, Math.min(100, input.score))],
  );
}

async function rebalanceRegimePins(
  pool: Pool,
  wallet: WalletAddress,
  at: Timestamp,
): Promise<void> {
  await pool.query(
    `WITH ranked AS (
       SELECT wallet,profile_id,token_mint,
              row_number() OVER (ORDER BY regime_score DESC,consecutive_qualifications DESC,
                                           qualified_at,profile_id,token_mint) AS pin_rank
         FROM paper_profile_regime_watches
        WHERE wallet=$1 AND status='active' AND consecutive_qualifications>=5
     ) UPDATE paper_profile_regime_watches w
           SET pinned=COALESCE(r.pin_rank<=8,false),updated_at=$2
          FROM (SELECT w0.wallet,w0.profile_id,w0.token_mint,r0.pin_rank
                  FROM paper_profile_regime_watches w0 LEFT JOIN ranked r0
                    USING (wallet,profile_id,token_mint)
                 WHERE w0.wallet=$1 AND w0.status='active') r
         WHERE w.wallet=r.wallet AND w.profile_id=r.profile_id AND w.token_mint=r.token_mint`,
    [wallet, at],
  );
}

export async function collectFastMarketObservations(input: {
  pool: Pool;
  swap: Pick<SwapPort, "quote">;
  market: MarketObservationPort;
  wallet: WalletAddress;
  at: Timestamp;
  feeRaw: bigint;
  scheduledAt?: Timestamp;
  allowedCohorts?: ReadonlySet<"watch" | "ot_probe" | "rotating">;
  attemptExecutor?: ObservationAttemptExecutor<boolean>;
}): Promise<void> {
  const enabled = await input.pool.query<{ profile_id: TradingProfileId }>(
    `SELECT profile_id FROM paper_profile_activations
      WHERE wallet=$1 AND enabled=true AND mode='automatic_paper' AND profile_id=ANY($2::text[])`,
    [input.wallet, [...temporalProfileIds]],
  );
  if (enabled.rows.length === 0) return;
  const scheduledAt = input.scheduledAt ?? input.at;
  const cycleId = uuid([input.wallet, "observation-cycle", scheduledAt]);
  const allowedCohorts =
    input.allowedCohorts ?? new Set(["watch", "ot_probe", "rotating"] as const);
  const cycleStarted = new Date();
  await input.pool.query(
    `INSERT INTO paper_observation_cycles
       (id,epoch_id,scheduled_at,started_at,scheduler_lag_ms,status,dense_capacity,
        rotating_capacity,candidates_available,slots_selected,slots_empty,engine_version)
     VALUES($1,current_paper_validation_epoch_id(),$2,$3,$4,'running',8,8,0,0,16,$5)
     ON CONFLICT(epoch_id,scheduled_at) DO NOTHING`,
    [
      cycleId,
      scheduledAt,
      cycleStarted,
      Math.max(0, cycleStarted.getTime() - Date.parse(scheduledAt)),
      temporalEngineVersion,
    ],
  );
  await input.pool.query(
    `UPDATE paper_profile_regime_watches SET status='expired',pinned=false,updated_at=$2
      WHERE wallet=$1 AND status='active' AND qualified_at<$2::timestamptz-interval '24 hours'`,
    [input.wallet, input.at],
  );
  const oscillationEnabled = enabled.rows.some(
    ({ profile_id }) => profile_id === "oscillation_trader",
  );
  const trackingUniverseSize = oscillationEnabled
    ? oscillationObservationTrackingUniverseSize
    : fastObservationTrackingUniverseSize;
  const discoverySlots = oscillationEnabled
    ? oscillationObservationDiscoverySlots
    : fastObservationDiscoverySlots;
  const batchSize = observationConcurrency;
  await input.pool.query(
    `DELETE FROM paper_observation_probe_assignments
      WHERE wallet=$1 AND expires_at<=$2`,
    [input.wallet, input.at],
  );
  const assignProbe = async (channel: "fairness" | "responsive") =>
    input.pool.query(
      `WITH latest AS (
       SELECT DISTINCT ON(c.mint_address)c.mint_address,s.total_score,s.evaluated_at,
              COALESCE((SELECT array_agg(r.rule_id) FROM rule_evaluations r
                         WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),'{}') failed_rules,
              COALESCE((SELECT avg(abs(o.five_minute_price_change)) FROM paper_fast_market_observations o
                         WHERE o.wallet=$1 AND o.token_mint=c.mint_address
                           AND o.observed_at>=$2::timestamptz-interval '30 minutes'),0) volatility
         FROM candidates c JOIN LATERAL
              (SELECT evaluation_run_id,total_score,evaluated_at FROM score_breakdowns
                WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1)s ON true
        WHERE s.total_score>=8 AND s.evaluated_at>=$2::timestamptz-interval '15 minutes'
        ORDER BY c.mint_address,s.evaluated_at DESC
     ), universe AS (
       SELECT * FROM latest WHERE NOT(failed_rules&&$3::text[])
         AND NOT EXISTS(SELECT 1 FROM paper_profile_regime_watches w
                         WHERE w.wallet=$1 AND w.token_mint=latest.mint_address AND w.status='active')
         AND NOT EXISTS(SELECT 1 FROM paper_observation_probe_assignments p
                         WHERE p.wallet=$1 AND p.token_mint=latest.mint_address AND p.expires_at>$2)
     ), missing AS (
       SELECT GREATEST(0,2-count(*))::int n FROM paper_observation_probe_assignments
        WHERE wallet=$1 AND channel=$4 AND expires_at>$2
     ) INSERT INTO paper_observation_probe_assignments
          (epoch_id,wallet,token_mint,channel,assigned_at,expires_at,sparse_volatility_score)
       SELECT current_paper_validation_epoch_id(),$1,mint_address,$4,$2,$2::timestamptz+interval '30 minutes',volatility
         FROM universe ORDER BY
           CASE WHEN $4='responsive' THEN -volatility ELSE 0 END,
           abs(hashtextextended(mint_address,floor(extract(epoch FROM $2::timestamptz)/1800)::bigint)),mint_address
         LIMIT(SELECT n FROM missing) ON CONFLICT DO NOTHING`,
      [input.wallet, input.at, observationUniverseBlockingRuleIds, channel],
    );
  await assignProbe("fairness");
  await assignProbe("responsive");
  const candidates = await input.pool.query<FastObservationCandidate>(
    `WITH observation_history AS (
       SELECT token_mint,max(observed_at) AS last_observed,
              count(*) FILTER (WHERE observed_at >= $2::timestamptz-interval '15 minutes')::int
                AS recent_observations
         FROM paper_fast_market_observations WHERE wallet=$1 GROUP BY token_mint
     ), active_watches AS (
       SELECT token_mint,array_agg(profile_id ORDER BY profile_id) AS watched_profiles,
              bool_or(pinned) AS pinned,max(regime_score) AS watch_score,max(qualified_at) AS qualified_at
         FROM paper_profile_regime_watches
        WHERE wallet=$1 AND status='active' AND qualified_at >= $2::timestamptz-interval '24 hours'
          AND profile_id=ANY($7::text[])
        GROUP BY token_mint
     ), latest AS (
       SELECT DISTINCT ON (c.mint_address) c.id::text AS candidate_id,c.mint_address,
              s.total_score,s.breakdown_json,s.evaluated_at,
              COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                         WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),'{}') AS failed_rules,
              h.last_observed,COALESCE(h.recent_observations,0) AS recent_observations,
              COALESCE(w.pinned,false) AS pinned,w.watched_profiles,w.watch_score,w.qualified_at
         FROM candidates c JOIN LATERAL
              (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
                WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
              LEFT JOIN observation_history h ON h.token_mint=c.mint_address
              LEFT JOIN active_watches w ON w.token_mint=c.mint_address
        WHERE s.total_score>=8 AND (s.evaluated_at >= $2::timestamptz-interval '15 minutes'
                                  OR w.token_mint IS NOT NULL)
        ORDER BY c.mint_address,s.evaluated_at DESC
     ), universe AS (
       -- Market points can improve; static authority and holder failures cannot.
       -- Spend bounded quote capacity on fresh, security-verified candidates.
       SELECT * FROM latest
        WHERE NOT (failed_rules && $3::text[])
     ), watch_due AS (
       SELECT * FROM universe WHERE watched_profiles IS NOT NULL
         AND (last_observed IS NULL OR last_observed <= $2::timestamptz-interval '15 seconds')
        ORDER BY ${observationWatchSlotOrderSql} LIMIT 4
     ), probe_due AS (
       SELECT universe.* FROM universe JOIN paper_observation_probe_assignments p
         ON p.wallet=$1 AND p.token_mint=universe.mint_address AND p.expires_at>$2
        WHERE watched_profiles IS NULL
         AND (last_observed IS NULL OR last_observed <= $2::timestamptz-interval '15 seconds')
        ORDER BY p.channel,p.assigned_at,p.token_mint LIMIT 4
     ), rotating_pool AS (
       SELECT * FROM universe WHERE watched_profiles IS NULL
         AND NOT EXISTS (SELECT 1 FROM probe_due b WHERE b.mint_address=universe.mint_address)
        ORDER BY last_observed ASC NULLS FIRST,recent_observations ASC,total_score DESC,evaluated_at DESC,
                 abs(hashtextextended(mint_address,floor(extract(epoch FROM $2::timestamptz)/3600)::bigint))
        LIMIT $4
     ), rotating_due AS (
       SELECT * FROM rotating_pool
        WHERE last_observed IS NULL OR last_observed <= $2::timestamptz-interval '30 seconds'
        ORDER BY last_observed ASC NULLS FIRST,recent_observations DESC,total_score DESC
        LIMIT $5
     ) SELECT candidate_id,mint_address,total_score,breakdown_json,evaluated_at,failed_rules,watched_profiles,
              observation_cohort
         FROM (SELECT watch_due.*,'watch'::text observation_cohort FROM watch_due
               UNION ALL SELECT probe_due.*,'ot_probe'::text FROM probe_due
               UNION ALL SELECT rotating_due.*,'rotating'::text FROM rotating_due) observation_batch
        ORDER BY CASE observation_cohort WHEN 'watch' THEN 0 WHEN 'ot_probe' THEN 1 ELSE 2 END,
                 last_observed ASC NULLS FIRST,total_score DESC LIMIT $6`,
    [
      input.wallet,
      input.at,
      observationUniverseBlockingRuleIds,
      trackingUniverseSize,
      discoverySlots,
      batchSize,
      enabled.rows.map(({ profile_id }) => profile_id),
    ],
  );
  await input.pool.query(
    `UPDATE paper_observation_cycles SET candidates_available=$2,slots_selected=$3,slots_empty=16-$3
      WHERE id=$1`,
    [cycleId, candidates.rows.length, candidates.rows.length],
  );
  const cohortIndexes = new Map<string, number>();
  const attemptIds = new Map<string, string>();
  for (const candidate of candidates.rows) {
    const slotIndex = cohortIndexes.get(candidate.observation_cohort) ?? 0;
    cohortIndexes.set(candidate.observation_cohort, slotIndex + 1);
    const attemptId = uuid([cycleId, candidate.observation_cohort, candidate.mint_address]);
    attemptIds.set(candidate.mint_address, attemptId);
    const accepted = allowedCohorts.has(candidate.observation_cohort);
    await input.pool.query(
      `INSERT INTO paper_observation_attempts
         (id,cycle_id,epoch_id,wallet,token_mint,cohort,slot_index,selection_reason,
          selected_at,outcome,engine_version,completed_at,total_latency_ms)
       VALUES($1,$2,current_paper_validation_epoch_id(),$3,$4,$5,$6,$7,$8,$9,$10,
              CASE WHEN $9='cancelled' THEN $8::timestamptz ELSE NULL END,
              CASE WHEN $9='cancelled' THEN 0 ELSE NULL END)`,
      [
        attemptId,
        cycleId,
        input.wallet,
        candidate.mint_address,
        candidate.observation_cohort,
        slotIndex,
        candidate.observation_cohort === "watch"
          ? "active regime watch"
          : candidate.observation_cohort === "ot_probe"
            ? "OT dense probe"
            : "broad rotating observation",
        input.at,
        accepted ? "queued" : "cancelled",
        temporalEngineVersion,
      ],
    );
  }
  const runnable = candidates.rows.filter((candidate) =>
    allowedCohorts.has(candidate.observation_cohort),
  );
  await input.pool.query(
    `UPDATE paper_observation_cycles SET attempts_enqueued=$2,attempts_completed=$3 WHERE id=$1`,
    [cycleId, runnable.length, candidates.rows.length - runnable.length],
  );
  const attemptExecutor =
    input.attemptExecutor ?? new ObservationAttemptExecutor<boolean>(observationConcurrency);
  const attemptResults = await Promise.all(
    runnable.map((candidate) => {
        const mint = candidate.mint_address as MintAddress;
        const attemptId = attemptIds.get(candidate.mint_address)!;
        return attemptExecutor.submit({
          id: attemptId,
          tokenMint: candidate.mint_address,
          cohort: candidate.observation_cohort,
          selectedAt: input.at,
          cancel: async () => {
            await input.pool.query(
              `UPDATE paper_observation_attempts SET outcome='cancelled',completed_at=now(),
                 total_latency_ms=0 WHERE id=$1 AND outcome='queued'`,
              [attemptId],
            );
          },
          execute: async () => {
        const attemptStarted = new Date();
        await input.pool.query(
          `UPDATE paper_observation_attempts SET outcome='running',started_at=$2,
         queue_delay_ms=GREATEST(0,round(extract(epoch FROM($2::timestamptz-selected_at))*1000)::int)
       WHERE id=$1`,
          [attemptId, attemptStarted],
        );
        const [quote, market] = await Promise.all([
          runInstrumentedProviderCall({
            pool: input.pool,
            attemptId,
            provider: "jupiter",
            operation: "quote",
            invoke: () =>
              input.swap.quote({
                inputMint: WRAPPED_SOL_MINT,
                outputMint: mint,
                inputAmount: observationInput,
                slippageBasisPoints: quoteSlippage,
                requestedAt: input.at,
              }),
          }),
          runInstrumentedProviderCall({
            pool: input.pool,
            attemptId,
            provider: "market_consensus",
            operation: "primary_pool",
            invoke: () => input.market.observePrimaryPool(mint, input.at),
          }),
        ]);
        if (!quote.ok || !market.ok) {
          const outcome =
            !quote.ok && !market.ok ? "both_failed" : !quote.ok ? "quote_failed" : "market_failed";
          const completed = new Date();
          await input.pool.query(
            `UPDATE paper_observation_attempts SET outcome=$2,completed_at=$3,
           total_latency_ms=GREATEST(0,round(extract(epoch FROM($3::timestamptz-started_at))*1000)::int),
           retry_count=$4 WHERE id=$1`,
            [
              attemptId,
              outcome,
              completed,
              Math.max(
                !quote.ok && quote.error.retryable ? 1 : 0,
                !market.ok && market.error.retryable ? 1 : 0,
              ),
            ],
          );
          return false;
        }
        const observation = market.value;
        const insertedObservation = await input.pool.query(
          `INSERT INTO paper_fast_market_observations
         (wallet,token_mint,observed_at,input_amount_raw,output_amount_raw,quote_fingerprint,
          market_price_usd,liquidity_usd,five_minute_volume_usd,five_minute_buys,
          five_minute_sells,five_minute_price_change,one_hour_price_change,market_evidence_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT DO NOTHING RETURNING observed_at`,
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
        const attemptCompleted = new Date();
        await input.pool.query(
          `UPDATE paper_observation_attempts SET outcome='success',completed_at=$2,
         total_latency_ms=GREATEST(0,round(extract(epoch FROM($2::timestamptz-started_at))*1000)::int),
         observation_recorded=true,observation_at=$3 WHERE id=$1`,
          [attemptId, attemptCompleted, quote.value.receivedAt],
        );
        if (insertedObservation.rowCount !== 1) return false;
        const history = await input.pool.query<FastObservationRow>(
          `WITH recent AS (
         SELECT observed_at,output_amount_raw,liquidity_usd,five_minute_volume_usd,
                five_minute_buys,five_minute_sells
           FROM paper_fast_market_observations
          WHERE wallet=$1 AND token_mint=$2 ORDER BY observed_at DESC LIMIT 64
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
            ? {
                poolAgeMinutes:
                  observation.pairCreatedAt === null
                    ? null
                    : Math.max(
                        0,
                        (Date.parse(input.at) - Date.parse(observation.pairCreatedAt)) / 60_000,
                      ),
              }
            : {}),
        }));
        const current = refreshTemporalCandidateEvidence({
          previousScore: candidate.breakdown_json,
          previousFailedRules: candidate.failed_rules ?? [],
          scoreEvaluatedAt: candidate.evaluated_at,
          observedAt: input.at,
          market: observation,
        });
        let producedEligibleSignal = false;
        for (const activation of enabled.rows) {
          const profile = tradingProfile(activation.profile_id);
          if (!profile) continue;
          const watched = candidate.watched_profiles?.includes(profile.id) ?? false;
          const oscillation =
            profile.id === "oscillation_trader" ? evaluateOscillation(points, { watched }) : null;
          const shortSignal =
            oscillation === null ? evaluateShortHorizonSignal(profile.id, points) : null;
          const fastRegime =
            profile.id === "fast_furious" && shortSignal !== null
              ? assessFastFuriousRegime(shortSignal)
              : null;
          if (oscillation !== null || fastRegime !== null)
            await updateRegimeWatch({
              pool: input.pool,
              wallet: input.wallet,
              profileId: profile.id,
              mint,
              at: input.at,
              score: oscillation?.score ?? fastRegime!.score,
              qualified: oscillation?.regimeQualified ?? fastRegime!.qualified,
              evaluable: oscillation?.gates.observations ?? fastRegime!.sampleCount >= 30,
            });
          if (oscillation !== null || fastRegime !== null) {
            const evaluable = oscillation?.gates.observations ?? fastRegime!.sampleCount >= 30;
            const qualified = oscillation?.regimeQualified ?? fastRegime!.qualified;
            await input.pool.query(
              `INSERT INTO paper_profile_evaluation_watermarks
             (epoch_id,wallet,profile_id,token_mint,last_observation_at,last_observation_fingerprint,
              last_evaluated_at,evaluation_result,engine_version)
           VALUES(current_paper_validation_epoch_id(),$1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT(epoch_id,wallet,profile_id,token_mint)DO UPDATE SET
             last_observation_at=EXCLUDED.last_observation_at,
             last_observation_fingerprint=EXCLUDED.last_observation_fingerprint,
             last_evaluated_at=EXCLUDED.last_evaluated_at,
             evaluation_result=EXCLUDED.evaluation_result,engine_version=EXCLUDED.engine_version
           WHERE paper_profile_evaluation_watermarks.last_observation_fingerprint<>EXCLUDED.last_observation_fingerprint`,
              [
                input.wallet,
                profile.id,
                candidate.mint_address,
                quote.value.receivedAt,
                quote.value.fingerprint,
                input.at,
                !evaluable ? "insufficient" : qualified ? "qualified" : "failed_market",
                temporalEngineVersion,
              ],
            );
          }
          const signal =
            shortSignal !== null
              ? shortSignal
              : Object.freeze({
                  eligible: oscillation!.eligible,
                  pattern: oscillation!.signalType ?? "none",
                  reason: oscillation!.reason,
                  observedVolatilityBps: oscillation!.meanAbsoluteReturnBps,
                });
          const adaptiveCalibration =
            oscillation === null
              ? calibrateProfile(profile.id, points, input.at)
              : Object.freeze({
                  version: "adaptive-v2" as const,
                  profileId: profile.id,
                  model: "executable oscillation mean reversion",
                  regime: "moderate" as const,
                  targetBps: oscillation.targetBps,
                  hardStopBps: oscillation.hardStopBps,
                  observedDownsideBps: oscillation.q75ExcursionBps,
                  trailingStopBps: oscillation.trailingStopBps,
                  trailingActivationBps: Math.max(25, Math.round(oscillation.targetBps / 2)),
                  maximumHoldingMinutes: oscillation.maximumHoldingMinutes,
                  maximumRoundTripCostBps: oscillation.maximumRoundTripCostBps,
                  sampleCount: oscillation.observationCount,
                  confidencePercentage: Math.min(95, 50 + oscillation.score / 2),
                  typicalMoveBps: oscillation.meanAbsoluteReturnBps,
                  upperMoveBps: oscillation.q75ExcursionBps,
                  riskSupported: true,
                  calculatedAt: input.at,
                  validUntil: new Date(Date.parse(input.at) + 2 * 60_000).toISOString(),
                  tradeable: oscillation.eligible,
                  reason: "Calibrated from non-overlapping executable-price excursions",
                } satisfies AdaptiveTradeCalibration);
          const rawAdaptiveEntry =
            oscillation === null
              ? evaluateAdaptiveEntry(profile.id, shortSignal!, adaptiveCalibration)
              : Object.freeze({ eligible: oscillation.eligible, reason: oscillation.reason });
          const adaptiveEntry =
            fastRegime === null
              ? rawAdaptiveEntry
              : Object.freeze({
                  eligible:
                    rawAdaptiveEntry.eligible &&
                    (watched || fastRegime.qualified) &&
                    fastRegime.sampleCount >= 20,
                  reason:
                    fastRegime.sampleCount < 20
                      ? "The rolling entry window has fewer than 20 observations"
                      : !(watched || fastRegime.qualified)
                        ? fastRegime.reason
                        : rawAdaptiveEntry.reason,
                });
          const profileDecision = evaluateProfileCandidate(
            profile,
            current.score,
            current.failedRules,
            { adaptiveEntryConfirmed: adaptiveEntry.eligible },
          );
          const eligible =
            adaptiveEntry.eligible && profileDecision.eligible && current.staticEvidenceFresh;
          const reasons = [
            adaptiveEntry.reason,
            ...profileDecision.reasons,
            ...(adaptiveCalibration ? [adaptiveCalibration.reason] : []),
            ...(!current.staticEvidenceFresh
              ? ["Token-security evidence is older than 15 minutes"]
              : []),
          ];
          if (!eligible) {
            const event = Object.freeze({
              profileId: profile.id,
              mint: candidate.mint_address,
              reason: reasons[0] ?? "Rejected without a recorded reason",
              ts: input.at,
            });
            profileSignalGateCounter.record(event);
            if (process.env.MEMECOINED_REJECTION_TELEMETRY_STDOUT === "1")
              console.info(
                JSON.stringify({
                  event: "profile_signal_rejected",
                  profile: event.profileId,
                  mint: event.mint,
                  reason: event.reason,
                  ts: event.ts,
                }),
              );
          }
          const signalEvidence = {
            ...signal,
            executableInputAmountRaw: quote.value.inputAmount.toString(),
            executableOutputAmountRaw: quote.value.expectedOutputAmount.toString(),
            adaptiveEntryEligible: adaptiveEntry.eligible,
            adaptiveEntryReason: adaptiveEntry.reason,
            ...(adaptiveCalibration ? { adaptiveCalibration } : {}),
            ...(oscillation ? { oscillation } : {}),
            ...(fastRegime ? { fastRegime } : {}),
            regimeWatched: watched,
            currentScore: current.score,
            currentFailedRules: current.failedRules,
            sourceScoreEvaluatedAt: iso(candidate.evaluated_at),
          };
          const signalId = uuid([
            input.wallet,
            profile.id,
            candidate.mint_address,
            input.at,
            signal.pattern ?? "none",
          ]);
          await input.pool.query(
            `INSERT INTO paper_profile_signals
           (id,wallet,profile_id,candidate_id,token_mint,signal_type,observed_at,
            engine_version,eligible,score,metrics_json,gates_json,rejection_reasons_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)
         ON CONFLICT DO NOTHING`,
            [
              signalId,
              input.wallet,
              profile.id,
              candidate.candidate_id,
              candidate.mint_address,
              signal.pattern === "none" ? null : signal.pattern,
              input.at,
              temporalEngineVersion,
              eligible,
              oscillation?.score ?? Math.max(0, Math.min(100, current.score.total)),
              JSON.stringify(signalEvidence),
              JSON.stringify(oscillation?.gates ?? {}),
              JSON.stringify(reasons),
            ],
          );
          await input.pool.query(
            `INSERT INTO paper_profile_signal_outcomes
           (signal_id,wallet,profile_id,token_mint,lifecycle_state,planned_target_bps,
            planned_stop_bps,estimated_friction_bps,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) ON CONFLICT DO NOTHING`,
            [
              signalId,
              input.wallet,
              profile.id,
              candidate.mint_address,
              eligible ? "observed" : "rejected",
              adaptiveCalibration?.targetBps ?? null,
              adaptiveCalibration?.hardStopBps ?? null,
              adaptiveCalibration?.maximumRoundTripCostBps ?? null,
              input.at,
            ],
          );
          const intent = eligible
            ? await input.pool.query(
                `INSERT INTO paper_profile_entry_intents
           (signal_id,wallet,profile_id,token_mint,state,next_attempt_at,created_at,updated_at)
         VALUES ($1,$2,$3,$4,'pending',$5,$5,$5)
         ON CONFLICT DO NOTHING RETURNING signal_id`,
                [signalId, input.wallet, profile.id, candidate.mint_address, input.at],
              )
            : null;
          const ownsEntryIntent = !eligible || intent?.rowCount === 1;
          producedEligibleSignal ||= eligible && ownsEntryIntent;
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
          // An independently valid signal is still telemetry when another live
          // intent or position owns this profile/token. It must not replace that
          // owner's execution identity or reset its state.
          if (eligible && !ownsEntryIntent) continue;
          if (eligible) {
            // Discovery can create several candidate rows for the same mint. Only
            // the freshest opportunity for a profile/token may own execution;
            // otherwise one market signal fans out into duplicate retries that can
            // consume quote capacity until every copy expires.
            await input.pool.query(
              `UPDATE paper_profile_candidate_decisions d
              SET eligible=false,entry_state='not_applicable',next_entry_attempt_at=NULL,
                  last_entry_error='Superseded by a newer opportunity for this token'
             FROM candidates superseded
            WHERE d.candidate_id=superseded.id AND d.wallet=$1 AND d.profile_id=$2
              AND superseded.mint_address=$3 AND d.candidate_id<>$4
              AND d.entry_state IN ('pending','retrying')`,
              [input.wallet, profile.id, candidate.mint_address, candidate.candidate_id],
            );
          }
          await input.pool.query(
            `INSERT INTO paper_profile_candidate_decisions
         (wallet,profile_id,candidate_id,mode,eligible,score,reasons_json,evaluated_at,
            entry_state,next_entry_attempt_at,signal_json,signal_observed_at,engine_version,signal_id)
         VALUES ($1,$2,$3,'automatic_paper',$4,$5,$6::jsonb,$7,
                 CASE WHEN $4 THEN 'pending' ELSE 'not_applicable' END,
                 CASE WHEN $4 THEN $7::timestamptz ELSE NULL END,$8::jsonb,$7,$9,$10)
         ON CONFLICT (wallet,profile_id,candidate_id) DO UPDATE SET
           eligible=EXCLUDED.eligible,score=EXCLUDED.score,reasons_json=EXCLUDED.reasons_json,
           evaluated_at=EXCLUDED.evaluated_at,signal_json=EXCLUDED.signal_json,
           signal_observed_at=EXCLUDED.signal_observed_at,engine_version=EXCLUDED.engine_version,
           signal_id=CASE WHEN paper_profile_candidate_decisions.entry_state='entered'
                          THEN paper_profile_candidate_decisions.signal_id ELSE EXCLUDED.signal_id END,
           entry_state=CASE
             WHEN paper_profile_candidate_decisions.entry_state='entered' THEN 'entered'
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
             THEN $7::timestamptz ELSE NULL END
         WHERE EXCLUDED.eligible
            OR paper_profile_candidate_decisions.entry_state NOT IN ('pending','retrying')`,
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
              signalId,
            ],
          );
        }
        return producedEligibleSignal;
          },
        });
      }),
  );
  const anyEligibleSignal = attemptResults.some((result) => result === true);
  await input.pool.query(
    `UPDATE paper_observation_cycles c SET completed_at=now(),
       attempts_completed=(SELECT count(*) FROM paper_observation_attempts a
                            WHERE a.cycle_id=c.id AND a.outcome NOT IN('queued','running')),
       observations_persisted=(SELECT count(*) FROM paper_observation_attempts a
                               WHERE a.cycle_id=c.id AND a.observation_recorded),
       status=CASE WHEN EXISTS(SELECT 1 FROM paper_observation_attempts a WHERE a.cycle_id=c.id
                               AND a.outcome NOT IN('success','cancelled'))
                   THEN 'partial' ELSE 'completed' END
     WHERE c.id=$1`,
    [cycleId],
  );
  await rebalanceRegimePins(input.pool, input.wallet, input.at);
  // Entry processing is deliberately serialized after concurrent observation.
  // Concurrent pending-entry consumers can quote the same live intent before
  // either transaction commits, creating avoidable contention and false errors.
  if (anyEligibleSignal)
    await processPendingEntries({
      pool: input.pool,
      swap: input.swap,
      wallet: input.wallet,
      at: input.at,
      feeRaw: input.feeRaw,
    });
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
  const lossCooldownMinutes =
    input.profile.id === "scalper"
      ? 15
      : input.profile.id === "fast_furious"
        ? 30
        : input.profile.id === "oscillation_trader"
          ? 240
          : shortHorizonProfiles.has(input.profile.id)
            ? 120
            : 360;
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
    const demonstrablyImproved =
      technical?.higherLows === true &&
      Number(technical.historyReturnBps ?? 0) > 0 &&
      Number(technical.qualityScore ?? 0) >= 75 &&
      Number(technical.efficiencyRatio ?? 0) >= 0.4 &&
      Number(technical.maximumDrawdownBps ?? Infinity) <= 500;
    if (!demonstrablyImproved)
      return Object.freeze({
        outcome: "failed",
        reason:
          "A recent hard stop remains negative evidence across strategies; the price structure has not demonstrably improved",
      });
  }
  if (Number(row.open_positions) >= input.profile.maximumConcurrentPositions)
    return Object.freeze({ outcome: "retry", reason: "Profile position limit is currently full" });
  const calibratedStopBps =
    input.candidate.signal_json?.adaptiveCalibration?.hardStopBps ?? input.profile.hardStopBps;
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
    : input.profile.id === "scalper"
      ? 100n
      : 200n;
  if (roundTripLossBps > maximumFrictionBps)
    return Object.freeze({
      outcome: "failed",
      reason: `Executable round-trip cost ${roundTripLossBps} bps exceeds this profile's ${maximumFrictionBps} bps limit`,
    });
  // The provider receives the quote after the simulation cycle begins. Use that
  // later timestamp for the audited fill so filled_at can never precede quoted_at.
  const filledAt = q.receivedAt;
  const fillId = uuid([input.wallet, input.profile.id, "buy", q.fingerprint]);
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
       (wallet,profile_id,token_mint,candidate_id,token_amount_raw,cost_raw,current_value_raw,high_water_raw,entry_signal_json,engine_version,entry_fee_raw,opened_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$7::jsonb,$8,$9,$10,$10) ON CONFLICT DO NOTHING`,
      [
        input.wallet,
        input.profile.id,
        input.candidate.mint_address,
        input.candidate.candidate_id,
        q.expectedOutputAmount.toString(),
        q.inputAmount.toString(),
        JSON.stringify(input.candidate.signal_json ?? null),
        temporalEngineVersion,
        input.feeRaw.toString(),
        filledAt,
      ],
    );
    if (inserted.rowCount !== 1) throw new Error("Profile position changed during entry");
    await client.query(
      `INSERT INTO paper_profile_fills
       (id,wallet,profile_id,candidate_id,side,token_mint,token_amount_raw,settlement_amount_raw,execution_fee_raw,quote_fingerprint,reason,engine_version,decision_snapshot_json,quoted_at,filled_at)
       VALUES ($1,$2,$3,$4,'buy',$5,$6,$7,$8,$9,'profile_entry',$10,$11::jsonb,$12,$13)`,
      [
        fillId,
        input.wallet,
        input.profile.id,
        input.candidate.candidate_id,
        input.candidate.mint_address,
        q.expectedOutputAmount.toString(),
        q.inputAmount.toString(),
        input.feeRaw.toString(),
        q.fingerprint,
        temporalEngineVersion,
        JSON.stringify(input.candidate.signal_json ?? null),
        q.receivedAt,
        filledAt,
      ],
    );
    return true;
  });
  return entered
    ? Object.freeze({ outcome: "entered", fillId })
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
    `WITH current_per_token AS (
       SELECT DISTINCT ON (d.profile_id,c.mint_address)
              d.profile_id,d.entry_attempts,d.entry_state,d.next_entry_attempt_at,
              d.signal_json,d.signal_observed_at,d.signal_id::text,c.id::text AS candidate_id,c.mint_address,
              s.total_score,s.breakdown_json,s.evaluated_at,
              COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                         WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),'{}') AS failed_rules
         FROM paper_profile_candidate_decisions d
         JOIN candidates c ON c.id=d.candidate_id
         LEFT JOIN paper_profile_entry_intents i ON i.signal_id=d.signal_id
         JOIN LATERAL (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
                        WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
        WHERE d.wallet=$1 AND d.eligible=true AND d.mode='automatic_paper'
          AND d.entry_state IN ('pending','retrying') AND d.entry_attempts < 5
          AND d.next_entry_attempt_at <= $2
          AND (d.profile_id<>'oscillation_trader' OR
               (i.state IN ('pending','retrying') AND i.next_attempt_at <= $2))
        ORDER BY d.profile_id,c.mint_address,d.signal_observed_at DESC NULLS LAST,
                 d.next_entry_attempt_at DESC,c.id DESC
     ) SELECT profile_id,entry_attempts,signal_json,signal_observed_at,signal_id,candidate_id,mint_address,
              total_score,breakdown_json,evaluated_at,failed_rules
         FROM current_per_token
        ORDER BY row_number() OVER (
                   PARTITION BY profile_id
                   ORDER BY CASE WHEN entry_state='pending' THEN 0 ELSE 1 END,
                            signal_observed_at DESC NULLS LAST,next_entry_attempt_at,candidate_id),
                 CASE WHEN profile_id LIKE 'benchmark_%' THEN 1 ELSE 0 END,
                 signal_observed_at DESC NULLS LAST,profile_id,candidate_id
        LIMIT 40`,
    [input.wallet, input.at],
  );
  for (const candidate of due.rows) {
    const profile = tradingProfile(candidate.profile_id);
    if (!profile) continue;
    const scoreAgeMs = Date.parse(input.at) - new Date(candidate.evaluated_at).getTime();
    const signalAgeMs =
      candidate.signal_observed_at === null
        ? Infinity
        : Date.parse(input.at) - new Date(candidate.signal_observed_at).getTime();
    if (
      !Number.isFinite(scoreAgeMs) ||
      scoreAgeMs < 0 ||
      scoreAgeMs > 15 * 60_000 ||
      (temporalProfileIds.has(profile.id) &&
        (!Number.isFinite(signalAgeMs) || signalAgeMs < 0 || signalAgeMs > 2 * 60_000))
    ) {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET eligible=false,entry_state='failed',last_entry_error='Entry evidence expired before execution',next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, candidate.candidate_id],
      );
      if (candidate.signal_id)
        await input.pool.query(
          `UPDATE paper_profile_entry_intents SET state='expired',last_error='Entry evidence expired before execution',
                next_attempt_at=NULL,updated_at=$2 WHERE signal_id=$1`,
          [candidate.signal_id, input.at],
        );
      if (candidate.signal_id)
        await input.pool.query(
          `UPDATE paper_profile_signal_outcomes SET lifecycle_state='expired',updated_at=$2
          WHERE signal_id=$1 AND lifecycle_state='observed'`,
          [candidate.signal_id, input.at],
        );
      continue;
    }
    const signalEvidence = candidate.signal_json;
    const sourceScoreMatches =
      signalEvidence?.sourceScoreEvaluatedAt !== undefined &&
      Date.parse(signalEvidence.sourceScoreEvaluatedAt) ===
        new Date(candidate.evaluated_at).getTime();
    if (
      temporalProfileIds.has(profile.id) &&
      (!sourceScoreMatches ||
        signalEvidence?.currentScore === undefined ||
        signalEvidence.currentFailedRules === undefined)
    ) {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET eligible=false,entry_state='failed',last_entry_error='Current market evidence is missing or superseded',next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, candidate.candidate_id],
      );
      if (candidate.signal_id)
        await input.pool.query(
          `UPDATE paper_profile_entry_intents SET state='rejected',last_error=$2,next_attempt_at=NULL,updated_at=$3
          WHERE signal_id=$1`,
          [candidate.signal_id, "Current market evidence is missing or superseded", input.at],
        );
      if (candidate.signal_id)
        await input.pool.query(
          `UPDATE paper_profile_signal_outcomes SET lifecycle_state='rejected',updated_at=$2
          WHERE signal_id=$1 AND lifecycle_state='observed'`,
          [candidate.signal_id, input.at],
        );
      continue;
    }
    const currentDecision = evaluateProfileCandidate(
      profile,
      temporalProfileIds.has(profile.id) ? signalEvidence!.currentScore! : candidate.breakdown_json,
      temporalProfileIds.has(profile.id)
        ? signalEvidence!.currentFailedRules!
        : (candidate.failed_rules ?? []),
      { adaptiveEntryConfirmed: signalEvidence?.adaptiveEntryEligible === true },
    );
    if (!currentDecision.eligible) {
      await input.pool.query(
        `UPDATE paper_profile_candidate_decisions
            SET eligible=false,entry_state='failed',last_entry_error=$4,next_entry_attempt_at=NULL
          WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3`,
        [input.wallet, profile.id, candidate.candidate_id, currentDecision.reasons.join("; ")],
      );
      if (candidate.signal_id)
        await input.pool.query(
          `UPDATE paper_profile_entry_intents SET state='rejected',last_error=$2,next_attempt_at=NULL,updated_at=$3
          WHERE signal_id=$1`,
          [candidate.signal_id, currentDecision.reasons.join("; "), input.at],
        );
      if (candidate.signal_id)
        await input.pool.query(
          `UPDATE paper_profile_signal_outcomes SET lifecycle_state='rejected',updated_at=$2
          WHERE signal_id=$1 AND lifecycle_state='observed'`,
          [candidate.signal_id, input.at],
        );
      continue;
    }
    const confirmationPolicy = entryConfirmationPolicy(profile.id);
    if (confirmationPolicy.observations > 1) {
      const confirmations = await input.pool.query<{
        confirmations: string;
        span_seconds: string | null;
        first_output_raw: string | null;
        last_output_raw: string | null;
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
      if (
        count < confirmationPolicy.observations ||
        spanSeconds < confirmationPolicy.minimumSpanSeconds
      ) {
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
          [
            input.wallet,
            profile.id,
            candidate.candidate_id,
            `Entry arrived ${entryLag.moveBps} bps after the first confirmed signal, beyond half its calibrated target`,
          ],
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
      if (candidate.signal_id) {
        await input.pool.query(
          `UPDATE paper_profile_entry_intents SET state='entered',attempt_count=$2,entry_fill_id=$3,
                  next_attempt_at=NULL,last_error=NULL,updated_at=$4 WHERE signal_id=$1`,
          [candidate.signal_id, attempts, attempt.fillId, input.at],
        );
        await input.pool.query(
          `UPDATE paper_profile_signal_outcomes SET lifecycle_state='entered',entry_fill_id=$2,
                  entered_at=$3,
                  first_signal_input_raw=(SELECT (metrics_json->>'executableInputAmountRaw')::numeric
                                            FROM paper_profile_signals WHERE id=$1),
                  first_signal_output_raw=(SELECT (metrics_json->>'executableOutputAmountRaw')::numeric
                                             FROM paper_profile_signals WHERE id=$1),
                  entry_input_raw=(SELECT settlement_amount_raw FROM paper_profile_fills WHERE id=$2),
                  entry_output_raw=(SELECT token_amount_raw FROM paper_profile_fills WHERE id=$2),
                  entry_to_first_signal_bps=(SELECT round((
                                               ((s.metrics_json->>'executableOutputAmountRaw')::numeric*f.settlement_amount_raw)/
                                                NULLIF((s.metrics_json->>'executableInputAmountRaw')::numeric*f.token_amount_raw,0)-1
                                               )*10000,2)
                                               FROM paper_profile_signals s JOIN paper_profile_fills f ON f.id=$2
                                              WHERE s.id=$1),
                  planned_loss_bps=planned_stop_bps,updated_at=$3 WHERE signal_id=$1`,
          [candidate.signal_id, attempt.fillId, input.at],
        );
      }
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
    if (candidate.signal_id)
      await input.pool.query(
        `UPDATE paper_profile_entry_intents SET state=$2,attempt_count=$3,last_error=$4,
              next_attempt_at=$5,updated_at=$6 WHERE signal_id=$1`,
        [
          candidate.signal_id,
          terminal ? "rejected" : "retrying",
          attempts,
          attempt.reason,
          terminal ? null : nextAt,
          input.at,
        ],
      );
    if (candidate.signal_id && terminal)
      await input.pool.query(
        `UPDATE paper_profile_signal_outcomes SET lifecycle_state='rejected',updated_at=$2
        WHERE signal_id=$1 AND lifecycle_state='observed'`,
        [candidate.signal_id, input.at],
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
    `SELECT profile_id,token_mint,candidate_id,token_amount_raw::text,cost_raw::text,entry_fee_raw::text,high_water_raw::text,entry_signal_json,engine_version,opened_at
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
    const trailing =
      thesisMature &&
      high * 10_000n >= cost * BigInt(10_000 + trailingActivationBps) &&
      value * 10_000n <= high * BigInt(10_000 - adaptiveTrailingBps);
    const breakeven =
      profile.id === "oscillation_trader" &&
      high * 10_000n >= cost * BigInt(10_000 + Math.round(adaptiveTargetBps / 2)) &&
      value <= cost;
    const timeout =
      ageMinutes >= (calibration?.maximumHoldingMinutes ?? profile.maximumHoldingMinutes);
    if (!stop && !target && !trailing && !breakeven && !timeout) {
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
          : breakeven
            ? "breakeven_stop"
            : "time_limit";
    // As with entries, the quote is received after the cycle timestamp. Keep
    // the fill audit chronologically valid when an exit condition fires.
    const filledAt = q.receivedAt;
    const exitFillId = uuid([input.wallet, profile.id, "sell", q.fingerprint]);
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
                realized_pnl_raw=realized_pnl_raw+($4::numeric-$5::numeric-$6::numeric-$7::numeric),
                updated_at=$8
          WHERE wallet=$1 AND profile_id=$2`,
        [
          input.wallet,
          profile.id,
          net.toString(),
          value.toString(),
          cost.toString(),
          input.feeRaw.toString(),
          position.entry_fee_raw,
          filledAt,
        ],
      );
      await client.query(
        `INSERT INTO paper_profile_fills
         (id,wallet,profile_id,candidate_id,side,token_mint,token_amount_raw,settlement_amount_raw,execution_fee_raw,quote_fingerprint,reason,engine_version,quoted_at,filled_at)
         VALUES ($1,$2,$3,$4,'sell',$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          exitFillId,
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
      await client.query(
        `WITH linked AS (
           SELECT signal_id FROM paper_profile_candidate_decisions
            WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3 AND signal_id IS NOT NULL
         ) UPDATE paper_profile_entry_intents i SET state='closed',updated_at=$4
            FROM linked WHERE i.signal_id=linked.signal_id`,
        [input.wallet, profile.id, position.candidate_id, filledAt],
      );
      await client.query(
        `WITH linked AS (
           SELECT signal_id FROM paper_profile_candidate_decisions
            WHERE wallet=$1 AND profile_id=$2 AND candidate_id=$3 AND signal_id IS NOT NULL
         ), changes AS (
           SELECT linked.signal_id,
                  (((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000 AS change_bps
             FROM linked JOIN paper_profile_signals s ON s.id=linked.signal_id
             JOIN paper_fast_market_observations x ON x.wallet=s.wallet AND x.token_mint=s.token_mint
              AND x.observed_at BETWEEN $11::timestamptz AND $5::timestamptz
            WHERE s.metrics_json->>'executableOutputAmountRaw' IS NOT NULL
         ), excursion AS (
           SELECT signal_id,max(change_bps) FILTER (WHERE change_bps>0) AS favorable_bps,
                  abs(min(change_bps) FILTER (WHERE change_bps<0)) AS adverse_bps
             FROM changes GROUP BY signal_id
         ) UPDATE paper_profile_signal_outcomes o SET lifecycle_state='closed',exit_fill_id=$4,
              exited_at=$5,exit_reason=$6,
              realized_gross_bps=round((($7::numeric-$8::numeric)*10000/NULLIF($8::numeric,0)),2),
              realized_net_bps=round((($7::numeric-$8::numeric-$9::numeric-$10::numeric)*10000/NULLIF($8::numeric,0)),2),
              realized_friction_bps=round((($9::numeric+$10::numeric)*10000/NULLIF($8::numeric,0)),2),
              measured_round_trip_bps=round((($9::numeric+$10::numeric)*10000/NULLIF($8::numeric,0)),2),
              estimated_to_measured_friction_bps=round((($9::numeric+$10::numeric)*10000/NULLIF($8::numeric,0)),2)
                - estimated_friction_bps,
              realized_loss_bps=GREATEST(0,-round((($7::numeric-$8::numeric-$9::numeric-$10::numeric)*10000/NULLIF($8::numeric,0)),2)),
              realized_to_planned_loss_gap_bps=GREATEST(0,-round((($7::numeric-$8::numeric-$9::numeric-$10::numeric)*10000/NULLIF($8::numeric,0)),2))
                - planned_loss_bps,
              maximum_favorable_excursion_bps=GREATEST(0,round(excursion.favorable_bps,2)),
              maximum_adverse_excursion_bps=GREATEST(0,round(excursion.adverse_bps,2)),
              holding_seconds=GREATEST(0,extract(epoch FROM ($5::timestamptz-$11::timestamptz))::int),
              target_hit=($6='profit_target'),stop_hit=($6='hard_stop'),updated_at=$5
           FROM linked LEFT JOIN excursion USING (signal_id) WHERE o.signal_id=linked.signal_id`,
        [
          input.wallet,
          profile.id,
          position.candidate_id,
          exitFillId,
          filledAt,
          reason,
          value.toString(),
          cost.toString(),
          input.feeRaw.toString(),
          position.entry_fee_raw,
          iso(position.opened_at),
        ],
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
      [
        input.wallet,
        row.exit_fill_id,
        row.profile_id,
        row.token_mint,
        row.exit_reason,
        iso(row.exit_at),
        row.horizon_minutes,
        quote.value.receivedAt,
        row.entry_cost_raw,
        row.exit_value_raw,
        quote.value.expectedOutputAmount.toString(),
        row.target_bps,
        row.stop_bps,
        quote.value.fingerprint,
      ],
    );
  }
}

/**
 * Prices every signal at fixed future horizons, including rejected signals.
 * This is essential validation telemetry: measuring entered trades alone would
 * hide profitable opportunities rejected by an over-restrictive gate.
 */
async function updateSignalForwardReturns(input: {
  pool: Pool;
  wallet: WalletAddress;
  at: Timestamp;
}): Promise<void> {
  await input.pool.query(
    `WITH due AS (
       SELECT s.id FROM paper_profile_signals s
       JOIN paper_profile_signal_outcomes existing ON existing.signal_id=s.id
       WHERE s.wallet=$1 AND s.profile_id='oscillation_trader'
         AND s.observed_at >= $2::timestamptz-interval '4 hours'
         AND s.observed_at <= $2::timestamptz-interval '1 minute'
         AND (NOT (existing.forward_returns_json ? 'oneMinuteBps')
           OR (s.observed_at <= $2::timestamptz-interval '3 minutes' AND NOT (existing.forward_returns_json ? 'threeMinuteBps'))
           OR (s.observed_at <= $2::timestamptz-interval '5 minutes' AND NOT (existing.forward_returns_json ? 'fiveMinuteBps'))
           OR (s.observed_at <= $2::timestamptz-interval '10 minutes' AND NOT (existing.forward_returns_json ? 'tenMinuteBps')))
       ORDER BY s.observed_at LIMIT 64
     ) UPDATE paper_profile_signal_outcomes o SET
       forward_returns_json=jsonb_strip_nulls(jsonb_build_object(
         'oneMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '1 minute' ORDER BY x.observed_at LIMIT 1),
         'threeMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '3 minutes' ORDER BY x.observed_at LIMIT 1),
         'fiveMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '5 minutes' ORDER BY x.observed_at LIMIT 1),
         'tenMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '10 minutes' ORDER BY x.observed_at LIMIT 1)
       )),updated_at=$2
      FROM paper_profile_signals s JOIN due ON due.id=s.id
     WHERE o.signal_id=s.id AND o.wallet=$1
       AND s.metrics_json->>'executableOutputAmountRaw' IS NOT NULL
       AND o.forward_returns_json<>jsonb_strip_nulls(jsonb_build_object(
         'oneMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '1 minute' ORDER BY x.observed_at LIMIT 1),
         'threeMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '3 minutes' ORDER BY x.observed_at LIMIT 1),
         'fiveMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '5 minutes' ORDER BY x.observed_at LIMIT 1),
         'tenMinuteBps',(SELECT round((((s.metrics_json->>'executableOutputAmountRaw')::numeric/x.output_amount_raw)-1)*10000,2)
           FROM paper_fast_market_observations x WHERE x.wallet=s.wallet AND x.token_mint=s.token_mint
             AND x.observed_at>=s.observed_at+interval '10 minutes' ORDER BY x.observed_at LIMIT 1)
       ))`,
    [input.wallet, input.at],
  );
}

/** Runs attributable profile decisions and independent simulated sub-portfolios using executable quotes. */
export async function runProfilePaperSimulationCycle(input: {
  readonly database: Pool;
  readonly swap: Pick<SwapPort, "quote">;
  readonly market: MarketObservationPort;
  readonly wallet: WalletAddress;
  readonly now: () => Timestamp;
  readonly executionFeeRaw: bigint;
  readonly collectObservations?: boolean;
}): Promise<void> {
  const at = input.now();
  await ensureAccounts(input.database, input.wallet, at);
  if (input.collectObservations !== false)
    await collectFastMarketObservations({
      pool: input.database,
      swap: input.swap,
      market: input.market,
      wallet: input.wallet,
      at,
      feeRaw: input.executionFeeRaw,
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
  await updateSignalForwardReturns({ pool: input.database, wallet: input.wallet, at });
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
    `WITH positions AS (
       SELECT profile_id,
              sum(cost_raw) AS open_cost_raw,
              sum(current_value_raw) AS open_value_raw,
              count(*)::int AS open_positions,
              sum(current_value_raw) FILTER (WHERE engine_version=$2) AS engine_open_value_raw
         FROM paper_profile_positions WHERE wallet=$1 GROUP BY profile_id
     ), fills AS (
       SELECT profile_id,
              count(*) FILTER (WHERE engine_version=$2)::int AS fills,
              count(*)::int AS lifetime_fills,
              sum(CASE WHEN side='buy' THEN -settlement_amount_raw-execution_fee_raw
                       ELSE settlement_amount_raw-execution_fee_raw END)
                FILTER (WHERE engine_version=$2) AS engine_settlement_raw
         FROM paper_profile_fills WHERE wallet=$1 GROUP BY profile_id
     ), decisions AS (
       SELECT d.profile_id,
              count(*) FILTER (WHERE d.engine_version=$2)::int AS candidates_evaluated,
              count(DISTINCT c.mint_address) FILTER (WHERE d.engine_version=$2)::int AS unique_tokens_evaluated,
              count(*) FILTER (WHERE d.engine_version=$2 AND d.eligible)::int AS candidates_qualified,
              count(*)::int AS lifetime_candidates_evaluated,
              count(*) FILTER (WHERE d.engine_version=$2 AND d.entry_attempts>0)::int AS entries_attempted,
              count(*) FILTER (WHERE d.engine_version=$2 AND d.entry_state IN ('pending','retrying') AND d.entry_attempts<5 AND d.next_entry_attempt_at IS NOT NULL)::int AS entries_pending,
              count(*) FILTER (WHERE d.engine_version=$2 AND d.entry_state='failed')::int AS entries_failed,
              count(*) FILTER (WHERE d.engine_version=$2 AND d.entry_state='entered')::int AS entries_entered
         FROM paper_profile_candidate_decisions d
         JOIN candidates c ON c.id=d.candidate_id
        WHERE d.wallet=$1 GROUP BY d.profile_id
     ), signal_totals AS (
       SELECT profile_id,
              count(*)::int AS short_horizon_signals,
              count(*) FILTER (WHERE eligible)::int AS short_horizon_qualified,
              count(*) FILTER (WHERE signal_json ? 'adaptiveCalibration')::int AS adaptive_calibrations,
              count(*) FILTER (WHERE signal_json->'adaptiveCalibration'->>'tradeable'='true')::int AS adaptive_tradeable,
              count(*) FILTER (WHERE signal_json->'adaptiveCalibration'->>'tradeable'='true' AND signal_json->>'adaptiveEntryEligible'='false')::int AS adaptive_pattern_waiting
         FROM paper_fast_signal_events
        WHERE wallet=$1 AND observed_at>=now()-interval '24 hours' GROUP BY profile_id
     ), latest_signals AS (
       SELECT DISTINCT ON (profile_id) profile_id,signal_json AS latest_signal,observed_at AS latest_signal_at
         FROM paper_fast_signal_events
        WHERE wallet=$1 AND observed_at>=now()-interval '24 hours'
        ORDER BY profile_id,observed_at DESC
     ), observation_totals AS (
       SELECT COALESCE(sum(observations),0)::int AS market_observations,
              count(DISTINCT token_mint)::int AS monitored_tokens,
              count(*) FILTER (WHERE observations>=6)::int AS history_ready_tokens
         FROM (SELECT token_mint,count(*) AS observations
                 FROM paper_fast_market_observations
                WHERE wallet=$1 AND observed_at>=now()-interval '24 hours'
                GROUP BY token_mint) observed
     ), validation AS (
       SELECT profile_id,count(*)::int AS telemetry_signals,
              count(*) FILTER (WHERE lifecycle_state IN ('entered','closed'))::int AS telemetry_entered,
              count(*) FILTER (WHERE lifecycle_state='closed')::int AS telemetry_closed,
              count(*) FILTER (WHERE lifecycle_state='closed' AND realized_net_bps>0)::int AS telemetry_wins,
              round(avg(realized_net_bps) FILTER (WHERE lifecycle_state='closed'),2)::text AS average_net_bps,
              round(avg(realized_friction_bps) FILTER (WHERE lifecycle_state='closed'),2)::text AS average_realized_friction_bps,
              round(avg(holding_seconds) FILTER (WHERE lifecycle_state='closed'),0)::text AS average_holding_seconds,
              count(*) FILTER (WHERE lifecycle_state='rejected' AND
                NULLIF(forward_returns_json->>'fiveMinuteBps','')::numeric>0)::int AS profitable_rejections
         FROM paper_profile_signal_outcomes WHERE wallet=$1 GROUP BY profile_id
     )
     SELECT a.profile_id,a.initial_cash_raw::text,a.cash_raw::text,a.realized_pnl_raw::text,
            COALESCE(p.open_cost_raw,0)::text AS open_cost_raw,
            COALESCE(p.open_value_raw,0)::text AS open_value_raw,
            (a.cash_raw+COALESCE(p.open_value_raw,0)-a.initial_cash_raw)::text AS net_pnl_raw,
            COALESCE(p.open_positions,0)::int AS open_positions,
            COALESCE(f.fills,0)::int AS fills,
            COALESCE(d.candidates_evaluated,0)::int AS candidates_evaluated,
            COALESCE(d.unique_tokens_evaluated,0)::int AS unique_tokens_evaluated,
            COALESCE(d.candidates_qualified,0)::int AS candidates_qualified,
            (COALESCE(f.engine_settlement_raw,0)+COALESCE(p.engine_open_value_raw,0))::text AS current_engine_net_pnl_raw,
            COALESCE(f.lifetime_fills,0)::int AS lifetime_fills,
            COALESCE(d.lifetime_candidates_evaluated,0)::int AS lifetime_candidates_evaluated,
            COALESCE(d.entries_attempted,0)::int AS entries_attempted,
            COALESCE(d.entries_pending,0)::int AS entries_pending,
            COALESCE(d.entries_failed,0)::int AS entries_failed,
            COALESCE(d.entries_entered,0)::int AS entries_entered,
            COALESCE(s.short_horizon_signals,0)::int AS short_horizon_signals,
            COALESCE(s.short_horizon_qualified,0)::int AS short_horizon_qualified,
            COALESCE(s.adaptive_calibrations,0)::int AS adaptive_calibrations,
            COALESCE(s.adaptive_tradeable,0)::int AS adaptive_tradeable,
            COALESCE(s.adaptive_pattern_waiting,0)::int AS adaptive_pattern_waiting,
            l.latest_signal,l.latest_signal_at,
            COALESCE(o.market_observations,0)::int AS market_observations,
            COALESCE(o.monitored_tokens,0)::int AS monitored_tokens,
            COALESCE(o.history_ready_tokens,0)::int AS history_ready_tokens
            ,COALESCE(v.telemetry_signals,0)::int AS telemetry_signals
            ,COALESCE(v.telemetry_entered,0)::int AS telemetry_entered
            ,COALESCE(v.telemetry_closed,0)::int AS telemetry_closed
            ,COALESCE(v.telemetry_wins,0)::int AS telemetry_wins
            ,v.average_net_bps,v.average_realized_friction_bps,v.average_holding_seconds
            ,COALESCE(v.profitable_rejections,0)::int AS profitable_rejections
       FROM paper_profile_accounts a
       LEFT JOIN positions p USING (profile_id)
       LEFT JOIN fills f USING (profile_id)
       LEFT JOIN decisions d USING (profile_id)
       LEFT JOIN signal_totals s USING (profile_id)
       LEFT JOIN latest_signals l USING (profile_id)
       LEFT JOIN validation v USING (profile_id)
       CROSS JOIN observation_totals o
      WHERE a.wallet=$1 ORDER BY a.profile_id`,
    [wallet, temporalEngineVersion],
  );
  return result.rows;
}
