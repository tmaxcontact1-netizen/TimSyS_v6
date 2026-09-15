import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import type { SwapPort } from "../ports/swap.js";
import type { MarketObservationPort } from "../ports/market.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";
import {
  asBasisPoints,
  asRawAmount,
  asTimestamp,
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
    return new Set([...nonNegotiablePaperRuleIds, "SEC-008", "SEC-012"]);
  if (profile.id === "scalper")
    return new Set([...nonNegotiablePaperRuleIds, "SEC-008", "SEC-012"]);
  if (profile.id === "trend_detector")
    return new Set([...nonNegotiablePaperRuleIds, "SEC-008", "SEC-010", "SEC-012"]);
  if (profile.id === "liquidity_expansion")
    return new Set([...nonNegotiablePaperRuleIds, "SEC-005", "SEC-008", "SEC-010", "SEC-012"]);
  return new Set(strictPaperRuleIds);
}

/** Profile policy is deliberately deterministic and cannot override a failed safety gate. */
export function evaluateProfileCandidate(
  profile: TradingProfileDefinition,
  score: ProfileScoreBreakdown,
  failedSafetyRules: readonly string[],
): ProfileCandidateDecision {
  const reasons: string[] = [];
  if (profile.evidenceStatus === "awaiting_data")
    reasons.push(profile.evidenceMessage ?? "The evidence required by this profile is not connected yet");
  const requiredRules = requiredPaperRules(profile);
  const applicableFailures = failedSafetyRules.filter((ruleId) => requiredRules.has(ruleId));
  if (applicableFailures.length)
    reasons.push(`Required gates failed: ${applicableFailures.join(", ")}`);
  if (score.total < profile.minimumCandidateScore)
    reasons.push(
      `Score ${score.total} is below this profile's ${profile.minimumCandidateScore}-point threshold`,
    );
  if (profile.requiresWhaleConfirmation && score.wallet === 0)
    reasons.push("No qualifying tracked-wallet confirmation");
  if (profile.id === "fast_furious" && (score.momentum < 12 || score.volumeQuality < 5))
    reasons.push("Short-term momentum and transaction quality do not agree");
  if (profile.id === "trend_detector" && (score.momentum < 12 || score.liquidity < 10))
    reasons.push("Emerging trend lacks sufficient momentum or liquidity");
  if (
    profile.id === "liquidity_expansion" &&
    (score.liquidity < 15 || score.volumeQuality < 8 || score.holders < 5)
  )
    reasons.push("Liquidity, transaction quality and holder breadth do not yet agree");
  if (profile.id === "scalper" && (score.momentum < 16 || score.volumeQuality < 10 || score.liquidity < 8))
    reasons.push("Immediate momentum, liquidity and transaction quality do not yet agree");
  if (profile.id === "slow_steady" && (score.liquidity < 15 || score.holders < 8))
    reasons.push("Liquidity or holder distribution is below the long-hold standard");
  if (
    profile.id === "signal_consensus" &&
    [score.wallet, score.liquidity, score.momentum, score.holders, score.volumeQuality].some(
      (value) => value === 0,
    )
  )
    reasons.push("All five independent signal groups must contribute");
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

interface CandidateRow {
  readonly candidate_id: string;
  readonly mint_address: string;
  readonly total_score: number;
  readonly breakdown_json: ProfileScoreBreakdown;
  readonly failed_rules: string[] | null;
  readonly evaluated_at: Date | string;
  readonly signal_json?: { readonly observedVolatilityBps?: number } | null;
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
  readonly entry_signal_json: { readonly observedVolatilityBps?: number } | null;
  readonly engine_version: string;
}
interface PendingEntryRow extends CandidateRow {
  readonly profile_id: TradingProfileId;
  readonly entry_attempts: number;
}
type EntryAttempt =
  Readonly<{ outcome: "entered" }> | Readonly<{ outcome: "retry" | "failed"; reason: string }>;

const quoteSlippage = asBasisPoints(150n);
const observationInput = asRawAmount(10_000_000n);
const temporalEngineVersion = "temporal-v3";
const fastProfileIds = new Set<TradingProfileId>([
  "fast_furious",
  "scalper",
  "trend_detector",
  "breakout_retest",
  "recovery_reversal",
]);
const iso = (value: Date | string): Timestamp => new Date(value).toISOString() as Timestamp;
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
            GREATEST(floor(a.initial_cash_raw*p.allocation_bps/10000),1),
            GREATEST(floor(a.initial_cash_raw*p.allocation_bps/10000),1),$2,$2
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
    [input.wallet, [...fastProfileIds]],
  );
  if (enabled.rows.length === 0) return;
  const candidates = await input.pool.query<FastObservationCandidate>(
    `WITH latest AS (
       SELECT DISTINCT ON (c.mint_address) c.id::text AS candidate_id,c.mint_address,
              s.total_score,s.breakdown_json,s.evaluated_at,
              COALESCE((SELECT array_agg(r.rule_id ORDER BY r.rule_id) FROM rule_evaluations r
                         WHERE r.evaluation_run_id=s.evaluation_run_id AND r.outcome<>'pass'),'{}') AS failed_rules,
              (SELECT max(o.observed_at) FROM paper_fast_market_observations o
                WHERE o.wallet=$1 AND o.token_mint=c.mint_address) AS last_observed
         FROM candidates c JOIN LATERAL
              (SELECT evaluation_run_id,total_score,breakdown_json,evaluated_at FROM score_breakdowns
                WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
        WHERE s.total_score>=30 AND s.evaluated_at >= $2::timestamptz-interval '6 hours'
        ORDER BY c.mint_address,s.evaluated_at DESC
     ), universe AS (
       -- Keep the monitored set deliberately small enough to build a useful
       -- time series in minutes. A broad scan belongs to discovery; temporal
       -- strategies need repeated measurements of the same liquid candidates.
       SELECT * FROM latest ORDER BY total_score DESC,evaluated_at DESC LIMIT 12
     ) SELECT candidate_id,mint_address,total_score,breakdown_json,evaluated_at,failed_rules
         FROM universe
        WHERE last_observed IS NULL OR last_observed <= $2::timestamptz-interval '20 seconds'
        ORDER BY COALESCE(last_observed,'epoch'::timestamptz),evaluated_at DESC LIMIT 6`,
    [input.wallet, input.at],
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
      [input.wallet, candidate.mint_address, quote.value.receivedAt,
       quote.value.inputAmount.toString(), quote.value.expectedOutputAmount.toString(), quote.value.fingerprint,
       observation.priceUsd?.toString() ?? null, observation.liquidityUsd?.toString() ?? null,
       observation.fiveMinuteVolumeUsd?.toString() ?? null,
       observation.fiveMinuteBuys?.toString() ?? null, observation.fiveMinuteSells?.toString() ?? null,
       observation.fiveMinutePriceChangePercentage?.toString() ?? null,
       observation.oneHourPriceChangePercentage?.toString() ?? null,
       JSON.stringify(
         observation.traces ?? [observation.trace],
         (_key, value) => typeof value === "bigint" ? value.toString() : value,
       )],
    );
    const history = await input.pool.query<FastObservationRow>(
      `SELECT observed_at,output_amount_raw::text,liquidity_usd::text,five_minute_volume_usd::text,
              five_minute_buys::text,five_minute_sells::text
         FROM paper_fast_market_observations
        WHERE wallet=$1 AND token_mint=$2 ORDER BY observed_at DESC LIMIT 6`,
      [input.wallet, candidate.mint_address],
    );
    const points: ExecutableMarketPoint[] = history.rows.reverse().map((row) => ({
      observedAt: iso(row.observed_at),
      outputAmountRaw: BigInt(row.output_amount_raw),
      liquidityUsd: row.liquidity_usd,
      fiveMinuteVolumeUsd: row.five_minute_volume_usd,
      fiveMinuteBuys: row.five_minute_buys === null ? null : BigInt(row.five_minute_buys),
      fiveMinuteSells: row.five_minute_sells === null ? null : BigInt(row.five_minute_sells),
    }));
    for (const activation of enabled.rows) {
      const profile = tradingProfile(activation.profile_id);
      if (!profile) continue;
      const signal = evaluateShortHorizonSignal(profile.id, points);
      const requiredRules = requiredPaperRules(profile);
      const safetyFailed = (candidate.failed_rules ?? []).some((rule) => requiredRules.has(rule));
      const score = candidate.breakdown_json;
      const appetite = profile.id === "scalper"
        ? score.total >= 40 && score.liquidity >= 10 && score.volumeQuality >= 5
        : score.total >= 35 && score.liquidity >= 10;
      const eligible = signal.eligible && appetite && !safetyFailed;
      const reasons = [
        signal.reason,
        ...(appetite ? [] : ["Market quality is below this fast profile's minimum"]),
        ...(safetyFailed ? ["A required safety gate failed"] : []),
      ];
      await input.pool.query(
        `INSERT INTO paper_fast_signal_events
           (wallet,profile_id,candidate_id,token_mint,observed_at,eligible,signal_json,reasons_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) ON CONFLICT DO NOTHING`,
        [input.wallet, profile.id, candidate.candidate_id, candidate.mint_address, input.at,
         eligible, JSON.stringify(signal), JSON.stringify(reasons)],
      );
      await input.pool.query(
        `INSERT INTO paper_profile_candidate_decisions
           (wallet,profile_id,candidate_id,mode,eligible,score,reasons_json,evaluated_at,
            entry_state,next_entry_attempt_at,signal_json,signal_observed_at)
         VALUES ($1,$2,$3,'automatic_paper',$4,$5,$6::jsonb,$7,
                 CASE WHEN $4 THEN 'pending' ELSE 'not_applicable' END,
                 CASE WHEN $4 THEN $7::timestamptz ELSE NULL END,$8::jsonb,$7)
         ON CONFLICT (wallet,profile_id,candidate_id) DO UPDATE SET
           eligible=EXCLUDED.eligible,score=EXCLUDED.score,reasons_json=EXCLUDED.reasons_json,
           evaluated_at=EXCLUDED.evaluated_at,signal_json=EXCLUDED.signal_json,
           signal_observed_at=EXCLUDED.signal_observed_at,
           entry_state=CASE
             WHEN paper_profile_candidate_decisions.entry_state IN ('pending','retrying') THEN paper_profile_candidate_decisions.entry_state
             WHEN EXCLUDED.eligible AND paper_profile_candidate_decisions.entry_state<>'entered'
               AND (paper_profile_candidate_decisions.entered_at IS NULL OR paper_profile_candidate_decisions.entered_at <= $7::timestamptz-interval '5 minutes')
             THEN 'pending' ELSE 'not_applicable' END,
           next_entry_attempt_at=CASE WHEN EXCLUDED.eligible THEN $7::timestamptz ELSE NULL END`,
        [input.wallet, profile.id, candidate.candidate_id, eligible, candidate.total_score,
         JSON.stringify(reasons), input.at, JSON.stringify(signal)],
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
  const state = await input.pool.query<{
    cash_raw: string;
    initial_cash_raw: string;
    open_positions: string;
  }>(
    `SELECT a.cash_raw::text,a.initial_cash_raw::text,
            (SELECT count(*) FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id)::text AS open_positions
       FROM paper_profile_accounts a
      WHERE a.wallet=$1 AND a.profile_id=$2
        AND NOT EXISTS (SELECT 1 FROM paper_profile_positions p WHERE p.wallet=a.wallet AND p.profile_id=a.profile_id AND p.token_mint=$3)`,
    [input.wallet, input.profile.id, input.candidate.mint_address],
  );
  const row = state.rows[0];
  if (!row)
    return Object.freeze({ outcome: "retry", reason: "Position state changed before entry" });
  if (Number(row.open_positions) >= input.profile.maximumConcurrentPositions)
    return Object.freeze({ outcome: "retry", reason: "Profile position limit is currently full" });
  const riskSized =
    (BigInt(row.initial_cash_raw) * BigInt(input.profile.riskPerTradeBps)) /
    BigInt(input.profile.hardStopBps);
  const available = BigInt(row.cash_raw) - input.feeRaw;
  const amount = available < riskSized ? available : riskSized;
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
  const roundTripLossBps = immediateReturn >= BigInt(q.inputAmount)
    ? 0n
    : ((BigInt(q.inputAmount) - immediateReturn) * 10_000n) / BigInt(q.inputAmount);
  const maximumFrictionBps = input.profile.id === "scalper" ? 100n : 200n;
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
    `SELECT d.profile_id,d.entry_attempts,d.signal_json,c.id::text AS candidate_id,c.mint_address,
            s.total_score,s.breakdown_json,s.evaluated_at,NULL::text[] AS failed_rules
       FROM paper_profile_candidate_decisions d
       JOIN candidates c ON c.id=d.candidate_id
       JOIN LATERAL (SELECT total_score,breakdown_json,evaluated_at FROM score_breakdowns
                      WHERE candidate_id=c.id ORDER BY evaluated_at DESC,id DESC LIMIT 1) s ON true
      WHERE d.wallet=$1 AND d.eligible=true AND d.mode='automatic_paper'
        AND d.entry_state IN ('pending','retrying') AND d.entry_attempts < 5
        AND d.next_entry_attempt_at <= $2
      ORDER BY d.next_entry_attempt_at,d.evaluated_at,d.profile_id LIMIT 20`,
    [input.wallet, input.at],
  );
  for (const candidate of due.rows) {
    const profile = tradingProfile(candidate.profile_id);
    if (!profile) continue;
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
      if (fastProfileIds.has(profile.id)) continue;
      const decision = evaluateProfileCandidate(
        profile,
        candidate.breakdown_json,
        candidate.failed_rules ?? [],
      );
      await input.pool.query(
        `INSERT INTO paper_profile_candidate_decisions
         (wallet,profile_id,candidate_id,mode,eligible,score,reasons_json,evaluated_at,
          entry_state,next_entry_attempt_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,
                 CASE WHEN $5=true AND $4='automatic_paper' THEN 'pending' ELSE 'not_applicable' END,
                 CASE WHEN $5=true AND $4='automatic_paper' THEN $8::timestamptz ELSE NULL::timestamptz END)
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
    const observedVolatility = Math.max(0, Number(position.entry_signal_json?.observedVolatilityBps ?? 0));
    const adaptiveStopBps = observedVolatility
      ? Math.min(profile.hardStopBps, Math.max(Math.round(observedVolatility * 1.25), Math.round(profile.hardStopBps / 2)))
      : profile.hardStopBps;
    const adaptiveTargetBps = observedVolatility
      ? Math.min(profile.firstProfitTargetBps, Math.max(Math.round(observedVolatility * 1.75), Math.round(profile.firstProfitTargetBps / 2)))
      : profile.firstProfitTargetBps;
    const adaptiveTrailingBps = observedVolatility
      ? Math.min(profile.trailingStopBps, Math.max(Math.round(observedVolatility), Math.round(profile.trailingStopBps / 2)))
      : profile.trailingStopBps;
    const stop = value * 10000n <= cost * BigInt(10000 - adaptiveStopBps);
    const target = value * 10000n >= cost * BigInt(10000 + adaptiveTargetBps);
    const trailing =
      value * 10000n <= high * BigInt(10000 - adaptiveTrailingBps) && high > cost;
    const timeout = ageMinutes >= profile.maximumHoldingMinutes;
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
            (SELECT count(*) FROM paper_profile_fills f WHERE f.wallet=a.wallet AND f.profile_id=a.profile_id)::int AS fills,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id)::int AS candidates_evaluated,
            (SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.eligible)::int AS candidates_qualified
            ,(SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.entry_state IN ('pending','retrying'))::int AS entries_pending
            ,(SELECT count(*) FROM paper_profile_candidate_decisions d WHERE d.wallet=a.wallet AND d.profile_id=a.profile_id AND d.entry_state='failed')::int AS entries_failed
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id)::int AS short_horizon_signals
            ,(SELECT count(*) FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id AND e.eligible)::int AS short_horizon_qualified
            ,(SELECT e.signal_json FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id ORDER BY e.observed_at DESC LIMIT 1) AS latest_signal
            ,(SELECT e.observed_at FROM paper_fast_signal_events e WHERE e.wallet=a.wallet AND e.profile_id=a.profile_id ORDER BY e.observed_at DESC LIMIT 1) AS latest_signal_at
            ,(SELECT count(*) FROM paper_fast_market_observations o WHERE o.wallet=a.wallet)::int AS market_observations
            ,(SELECT count(DISTINCT o.token_mint) FROM paper_fast_market_observations o WHERE o.wallet=a.wallet)::int AS monitored_tokens
            ,(SELECT count(*) FROM (
                 SELECT o.token_mint FROM paper_fast_market_observations o
                  WHERE o.wallet=a.wallet GROUP BY o.token_mint HAVING count(*)>=6
              ) ready)::int AS history_ready_tokens
       FROM paper_profile_accounts a WHERE a.wallet=$1 ORDER BY a.profile_id`,
    [wallet],
  );
  return result.rows;
}
