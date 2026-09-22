/** Disposable database diagnostic of the actual paper trading path.
 * This is NOT release proof until discovery, safety/cost rejections and dashboard
 * assertions all pass for every selectable profile.
 * It never connects to, migrates, or resets the user's trading database.
 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool, Client } from "pg";
import { asDecimal, asPercentage, asStrategyVersionId, asTimestamp, asUuid,
  type EvidenceId, type SignalId } from "../src/domain/shared/types.js";
import { asMintAddress } from "../src/domain/token/token.js";
import { tradingProfileCatalogue } from "../src/domain/strategy/profiles.js";
import { runProfilePaperSimulationCycle } from "../src/application/services/profile-paper-simulation.js";
import { LiveCandidateDiscoverySource, discoverCandidate } from "../src/application/services/discovery.js";
import { evaluateAndPersistCandidate } from "../src/application/services/candidate-pipeline.js";
import type { CandidateEvaluationInput } from "../src/domain/candidate/evaluator.js";
import { PostgresCandidateDiscoveryRepository } from "../src/infrastructure/database/candidate-discovery.js";
import { PostgresCandidateEvaluationRepository } from "../src/infrastructure/database/candidate-evaluations.js";
import { ensureAllProfilesPaperTrialPreset, listPaperProfileActivations } from "../src/infrastructure/database/paper-profile-activations.js";
import { readPaperDashboardDetails, readPaperPerformanceHistory } from "../src/infrastructure/database/paper-dashboard.js";
import { WRAPPED_SOL_MINT } from "../src/application/services/portfolio-inventory-valuation.js";
import { applyMigrations, loadMigrationFiles } from "./migrate.js";

const adminUrl = process.env.MEMECOINED_VERIFY_ADMIN_URL;
if (!adminUrl) throw new Error("MEMECOINED_VERIFY_ADMIN_URL is required");
const databaseName = `memecoined_verify_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
if (!/^memecoined_verify_[0-9a-f]{12}$/.test(databaseName)) throw new Error("Unsafe diagnostic database name");
const admin = new Client({ connectionString: adminUrl });
const target = new URL(adminUrl);
target.pathname = `/${databaseName}`;
const profiles = tradingProfileCatalogue;
const wallet = "VerificationOnlyPaperWallet" as never;
const initial = Date.UTC(2026, 8, 22, 0, 0, 0);
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function tokenFor(index: number) {
  const bytes = Buffer.alloc(32);
  bytes[30] = index + 1;
  bytes[31] = index + 17;
  let value = BigInt(`0x${bytes.toString("hex")}`);
  let digits = "";
  while (value > 0n) {
    digits = base58Alphabet[Number(value % 58n)]! + digits;
    value /= 58n;
  }
  return asMintAddress("1".repeat(30) + digits);
}
const tokenIndex: Map<string, number> = new Map(profiles.map((_profile, index) => [tokenFor(index), index]));
const unsafeToken = tokenFor(profiles.length);
const costlyToken = tokenFor(profiles.length + 1);
tokenIndex.set(unsafeToken, profiles.findIndex((profile) => profile.id === "benchmark_momentum"));
tokenIndex.set(costlyToken, profiles.findIndex((profile) => profile.id === "benchmark_momentum"));
let cycle = 0;
const exitBoost = new Set<string>();
const observedBuyQuotes = new Set<string>();
let degradedQuoteCount = 0;

function candidateFacts(at: ReturnType<typeof asTimestamp>, unsafe: boolean): CandidateEvaluationInput {
  const evidence = [{ id: asUuid<EvidenceId>(randomUUID()), provider: "dexscreener" as const,
    observedAt: at, sourceKey: "isolated-verification" }];
  return {
    evaluatedAt: at, walletConfirmation: "tier_a",
    security: { observedAt: at, evidence, directlyVerifiedOnChain: true, program: "spl_token",
      mintAuthority: unsafe ? "active" : "revoked", freezeAuthority: "revoked",
      extensions: [], extensionsVerified: true,
      holders: { topTenNormalPercentage: asPercentage(20), largestNormalPercentage: asPercentage(5),
        exclusionsVerified: true } },
    market: { observedAt: at, evidence, chain: "solana", quoteAsset: "SOL",
      poolAgeMinutes: asDecimal(120), marketCapitalizationUsd: asDecimal(1_000_000),
      liquidityUsd: asDecimal(200_000), liquidityUsdFifteenMinutesAgo: asDecimal(200_000),
      fiveMinutePriceChange: asPercentage(6), oneHourPriceChange: asPercentage(15),
      fiveMinuteVolumeUsd: asDecimal(30_000), precedingOneHourVolumeUsd: asDecimal(100_000),
      fiveMinuteBuyTransactions: 60n, fiveMinuteSellTransactions: 20n,
      fiveMinuteUniqueBuyers: 35n, largestBuyerVolumePercentage: asPercentage(10),
      currentExecutablePriceUsd: asDecimal("1.02"), fiveMinuteExecutableHighUsd: asDecimal("1.05"),
      confirmingWalletVolumeWeightedEntryUsd: asDecimal("0.95") },
  };
}

function persistentTrendFixture(): number[] {
  let seed = 123456789;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  let prices: number[] = [];
  for (let trial = 0; trial <= 17145; trial++) {
    const slope = [.001, .0015, .002, .0025, .003, .004][Math.floor(random() * 6)]!;
    const amplitude = [.001, .002, .003, .004, .005, .007, .01][Math.floor(random() * 7)]!;
    const length = 40 + Math.floor(random() * 35);
    let current = 1;
    prices = [];
    for (let step = 0; step < length; step++) {
      let delta = slope + (random() - .5) * 2 * amplitude;
      if (step >= length - 5)
        delta = [.0015, .0015, -.0005, .0015, .0015][step - (length - 5)]! * (slope / .001);
      current += delta;
      prices.push(current);
    }
  }
  prices[1] = prices[1]! + .001;
  return prices;
}
const trendFixture = persistentTrendFixture();
const candidateFixtures = new Set<string>([
  "benchmark_bollinger_reversion", "benchmark_momentum", "benchmark_rsi_reversal",
  "benchmark_volume_breakout", ...profiles.filter((profile) => profile.group !== "benchmark").map((profile) => profile.id),
]);

function price(index: number, step: number): number {
  const profile = profiles[index]!;
  if (profile.id === "slow_steady" || profile.id === "trend_detector")
    return step < trendFixture.length ? trendFixture[step]! : trendFixture.at(-1)! + (step - trendFixture.length + 1) * .0003;
  if (profile.id === "scalper") return 1 + step * .0003 + .005 * Math.sin(.6 * step + 1);
  if (profile.id === "benchmark_rsi_reversal")
    return step < 23 ? 1 - step * .008 : .816 + (step - 23) * .007;
  if (profile.id === "benchmark_bollinger_reversion")
    return step < 24 ? 1 : step === 24 ? .94 : 1 + (step - 25) * .003;
  if (profile.id === "recovery_reversal" || profile.id === "breakout_retest")
    return 1 + step * .0008 + [0, .01, .002, -.006, .008][step % 5]!;
  return 1 + step * .003 + [0, .011, .022, .013, .024][step % 5]!;
}

async function main() {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${databaseName}`);
  const pool = new Pool({ connectionString: target.toString(), max: 4 });
  try {
    const migrationClient = await pool.connect();
    try {
      const files = await loadMigrationFiles(resolve("migrations"));
      await applyMigrations(migrationClient, files);
    } finally { migrationClient.release(); }
    const start = asTimestamp(new Date(initial));
    await pool.query(
      `INSERT INTO paper_accounts(wallet,settlement_mint,opened_at,initial_cash_raw)
       VALUES($1,$2,$3,10000000000)`, [wallet, WRAPPED_SOL_MINT, start],
    );
    const discoveryRepository = new PostgresCandidateDiscoveryRepository(pool);
    const evaluationRepository = new PostgresCandidateEvaluationRepository(pool);
    const discoveredMints = [...profiles.entries()]
      .filter(([, profile]) => candidateFixtures.has(profile.id))
      .map(([index]) => tokenFor(index));
    discoveredMints.push(unsafeToken, costlyToken);
    const source = new LiveCandidateDiscoverySource({
      strategyVersionId: asStrategyVersionId("strategy-v1.0.0"), now: () => start,
      deduplicationWindow: () => "isolated-verification",
      provider: { discoverLatestTokens: async (requestedAt) => ({
        ok: true as const,
        value: discoveredMints.map((mint) => ({ mint, sourceReference: `verify-${mint}`,
          observedAt: requestedAt, trace: { evidenceId: asUuid<EvidenceId>(randomUUID()),
            provider: "dexscreener" as const, method: "fixture", requestedAt,
            respondedAt: requestedAt, sourceTimestamp: requestedAt, normalizedAt: requestedAt,
            sourceKey: `verify-${mint}`, contentHash: "isolated-fixture" } })),
      }) },
    });
    const discovered = new Map<string, string>();
    for (const hint of await source.nextBatch()) {
      const recorded = await discoverCandidate(hint, discoveryRepository);
      if (!recorded.candidateCreated) throw new Error("Discovery did not create a candidate");
      discovered.set(hint.mint, hint.candidateId);
    }
    async function evaluateDiscovered(at: ReturnType<typeof asTimestamp>) {
      for (const [mint, candidateId] of discovered) {
        const result = await evaluateAndPersistCandidate({
          candidateId: candidateId as never,
          evaluationRunId: `verify-${cycle}-${mint}`,
          signalId: asUuid<SignalId>(randomUUID()),
          facts: candidateFacts(at, mint === unsafeToken),
          repository: evaluationRepository,
        });
        if (result.eligible === (mint === unsafeToken))
          throw new Error(`Unexpected candidate safety result for ${mint}`);
      }
    }
    await evaluateDiscovered(start);
    if (!await ensureAllProfilesPaperTrialPreset(pool, wallet, new Date(start)))
      throw new Error("The initial profile preset did not create the complete catalogue");
    const visibleProfiles = await listPaperProfileActivations(pool, wallet);
    if (visibleProfiles.length !== 19 || visibleProfiles.some((profile) =>
      profile.profileId === "whale_tracker" || profile.profileId === "social_catalyst"))
      throw new Error("Retired profiles remain in the selectable catalogue");
    await pool.query(
      `UPDATE paper_profile_activations SET enabled=true,mode='automatic_paper',
         allocation_bps=CASE WHEN profile_id LIKE 'benchmark_%' THEN 10000 ELSE 1000 END
       WHERE wallet=$1`, [wallet],
    );
    const swap = { quote: async (request: { inputMint: string; outputMint: string; inputAmount: bigint; requestedAt: string }) => {
      const mint = request.inputMint === WRAPPED_SOL_MINT ? request.outputMint : request.inputMint;
      const index = tokenIndex.get(mint);
      if (index === undefined) throw new Error(`Unknown diagnostic token ${mint}`);
      const quoteKey = `${cycle}-${mint}`;
      const uneconomicEntry = request.inputMint === WRAPPED_SOL_MINT && mint === costlyToken &&
        observedBuyQuotes.has(quoteKey);
      if (uneconomicEntry) degradedQuoteCount += 1;
      if (request.inputMint === WRAPPED_SOL_MINT) observedBuyQuotes.add(quoteKey);
      const quotedPrice = request.inputMint !== WRAPPED_SOL_MINT && exitBoost.has(mint)
        ? 1.7 : price(index, cycle) * (uneconomicEntry ? 2 : 1);
      const scaledPrice = BigInt(Math.round(quotedPrice * 1_000_000));
      const amount = BigInt(request.inputAmount);
      const output = request.inputMint === WRAPPED_SOL_MINT
        ? amount * 1_000_000_000n / scaledPrice
        : amount * scaledPrice * 998n / 1_000_000_000_000n;
      return { ok: true as const, value: {
        inputAmount: amount, expectedOutputAmount: output,
        receivedAt: request.requestedAt,
        fingerprint: `${cycle}-${mint}-${request.inputMint}-${amount}-${output}`,
      } };
    } };
    const market = { observePrimaryPool: async (mint: string, at: string) => ({
      ok: true as const, value: {
        mint, pairCreatedAt: asTimestamp(new Date(Date.parse(at) - 86_400_000)),
        priceUsd: asDecimal(price(tokenIndex.get(mint)!, cycle)),
        liquidityUsd: asDecimal(250_000 + cycle * 1000),
        fiveMinuteVolumeUsd: asDecimal(
          ["scalper", "slow_steady", "trend_detector"].includes(profiles[tokenIndex.get(mint)!]!.id)
            ? 30_000 + cycle * 300 : cycle % 8 === 5 ? 60_000 : 30_000 + cycle * 100,
        ),
        fiveMinuteBuys: 70n, fiveMinuteSells: 20n,
        fiveMinutePriceChangePercentage: asDecimal(6),
        trace: { provider: "diagnostic", sourceKey: "disposable" },
      },
    }) };
    for (cycle = 0; cycle < 100; cycle++) {
      const at = asTimestamp(new Date(initial + cycle * 30_000));
      if (cycle > 0 && cycle % 20 === 0) await evaluateDiscovered(at);
      await runProfilePaperSimulationCycle({ database: pool, swap: swap as never, market: market as never,
        wallet, now: () => at, executionFeeRaw: 5_000n });
      const open = await pool.query<{ token_mint: string }>(
        `SELECT DISTINCT token_mint FROM paper_profile_positions WHERE wallet=$1`, [wallet]);
      for (const row of open.rows) exitBoost.add(row.token_mint);
    }
    const result = await pool.query<{ profile_id: string; buys: string; sells: string }>(
      `SELECT a.profile_id,
              count(f.id) FILTER (WHERE f.side='buy')::text AS buys,
              count(f.id) FILTER (WHERE f.side='sell')::text AS sells
       FROM paper_profile_activations a LEFT JOIN paper_profile_fills f
         ON f.wallet=a.wallet AND f.profile_id=a.profile_id
       WHERE a.wallet=$1 GROUP BY a.profile_id ORDER BY a.profile_id`, [wallet]);
    const signals = await pool.query(
      `SELECT profile_id,count(*)::int AS observed,
              count(*) FILTER (WHERE eligible)::int AS eligible,
              (array_agg(reasons_json->>0 ORDER BY observed_at DESC))[1] AS latest_reason
       FROM paper_fast_signal_events WHERE wallet=$1 GROUP BY profile_id ORDER BY profile_id`, [wallet]);
    const states = await pool.query(
      `SELECT profile_id,entry_state,count(*)::int AS count,
              (array_agg(last_entry_error ORDER BY evaluated_at DESC))[1] AS latest_error
       FROM paper_profile_candidate_decisions WHERE wallet=$1
       GROUP BY profile_id,entry_state ORDER BY profile_id,entry_state`, [wallet]);
    const reasons = await pool.query(
      `SELECT profile_id,reasons_json->>0 AS reason,count(*)::int AS occurrences
       FROM paper_fast_signal_events WHERE wallet=$1 AND NOT eligible
       GROUP BY profile_id,reasons_json->>0 ORDER BY profile_id,occurrences DESC`, [wallet]);
    const signalByToken = await pool.query(
      `SELECT profile_id,token_mint,count(*) FILTER (WHERE eligible)::int AS eligible,
              count(*)::int AS observed
       FROM paper_fast_signal_events WHERE wallet=$1
         AND profile_id IN ('fast_furious','liquidity_expansion')
       GROUP BY profile_id,token_mint ORDER BY profile_id,eligible DESC`, [wallet]);
    const negativeFills = await pool.query<{ token_mint: string; fills: string }>(
      `SELECT token_mint,count(*)::text AS fills FROM paper_profile_fills
       WHERE wallet=$1 AND token_mint=ANY($2::text[]) GROUP BY token_mint`,
      [wallet, [unsafeToken, costlyToken]],
    );
    const unsafeObservations = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM paper_fast_market_observations
       WHERE wallet=$1 AND token_mint=$2`, [wallet, unsafeToken],
    );
    const costRejections = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM paper_profile_candidate_decisions d
       JOIN candidates c ON c.id=d.candidate_id
       WHERE d.wallet=$1 AND c.mint_address=$2
         AND d.last_entry_error LIKE 'Position-size price impact%'`,
      [wallet, costlyToken],
    );
    const dashboard = await readPaperDashboardDetails(pool, wallet);
    const performance = await readPaperPerformanceHistory(pool, wallet, "all");
    const failed = result.rows.filter((row) => Number(row.buys) === 0 || Number(row.sells) === 0);
    process.stdout.write(`${JSON.stringify({ diagnostic: "discovery-to-displayed-paper-result",
      controlledFixture: true, marketData: "synthetic; not a profitability estimate",
      profiles: result.rows,
      ...(failed.length ? { signals: signals.rows.filter((row) => failed.some((profile) => profile.profile_id === row.profile_id)),
        states: states.rows.filter((row) => failed.some((profile) => profile.profile_id === row.profile_id)),
        signalByToken: signalByToken.rows.filter((row) => failed.some((profile) => profile.profile_id === row.profile_id)),
        reasons: reasons.rows.filter((row) => failed.some((profile) => profile.profile_id === row.profile_id)).slice(0, 20) } : {}),
      negativeControls: { unsafeObservations: Number(unsafeObservations.rows[0]?.count ?? 0),
        degradedQuoteCount, priceImpactRejections: Number(costRejections.rows[0]?.count ?? 0),
        negativeFills: negativeFills.rows },
      dashboard: { displayedFills: dashboard.fills.length, performancePoints: performance.length,
        latestBookEquityRaw: performance.at(-1)?.bookEquityRaw ?? null },
    }, null, 2)}\n`);
    if (failed.length !== 0)
      process.exitCode = 1;
    if (unsafeObservations.rows[0]?.count !== "0" || degradedQuoteCount === 0 ||
        costRejections.rows[0]?.count === "0" || negativeFills.rows.length !== 0 ||
        dashboard.fills.length === 0 || performance.length < 2)
      process.exitCode = 1;
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${databaseName} WITH (FORCE)`);
    await admin.end();
  }
}

main().catch(async (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Diagnostic failed"}\n`);
  try { await admin.end(); } catch { /* best effort */ }
  process.exitCode = 1;
});
