import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";

import type { ObservationTrace, PoolMarketObservation } from "../contracts/observations.js";
import type { MarketObservationPort } from "../ports/market.js";
import type { MintSecurityObservationPort } from "../ports/runtime-authority-inputs.js";
import type { CandidateEvaluationLease } from "../ports/repositories.js";
import type { CandidateEvaluationFactSource } from "./candidate-evaluation-work.js";
import type { WalletIntelligenceRepository } from "./wallet-intelligence.js";
import { confirmAndPersistWallets } from "./wallet-intelligence.js";
import { createMarketSnapshot } from "../../domain/market/model.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asDecimal,
  asPercentage,
  type SignalId,
  type Timestamp,
} from "../../domain/shared/types.js";
import type { ConfirmingPurchase } from "../../domain/wallet/model.js";

export interface CandidateWalletPurchaseSource {
  load(
    candidateId: CandidateEvaluationLease["candidateId"],
  ): Promise<readonly ConfirmingPurchase[]>;
}

function reference(trace: ObservationTrace): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId,
    provider: trace.provider,
    observedAt: trace.respondedAt,
    sourceKey: trace.sourceKey,
    contentHash: trace.contentHash,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
  });
}

function percentage(value: Decimal | null) {
  return value !== null && value.gte(0) && value.lte(100) ? asPercentage(value) : null;
}

function weightedEntry(purchases: readonly ConfirmingPurchase[]): Decimal | null {
  const total = purchases.reduce((sum, item) => sum.plus(item.purchaseValueUsd), new Decimal(0));
  if (total.lte(0)) return null;
  return purchases
    .reduce((sum, item) => sum.plus(item.entryPriceUsd.mul(item.purchaseValueUsd)), new Decimal(0))
    .div(total);
}

function marketSnapshot(
  value: PoolMarketObservation,
  at: Timestamp,
  purchases: readonly ConfirmingPurchase[],
) {
  const poolAgeMinutes =
    value.pairCreatedAt === null
      ? null
      : asDecimal(new Decimal(Date.parse(at) - Date.parse(value.pairCreatedAt)).div(60_000));
  return createMarketSnapshot({
    observedAt: at,
    evidence: Object.freeze([reference(value.trace)]),
    chain: "solana",
    quoteAsset: value.quoteMint === "So11111111111111111111111111111111111111112" ? "SOL" : "other",
    poolAgeMinutes,
    marketCapitalizationUsd: value.marketCapitalizationUsd,
    liquidityUsd: value.liquidityUsd,
    liquidityUsdFifteenMinutesAgo: null,
    fiveMinutePriceChange: percentage(value.fiveMinutePriceChangePercentage),
    oneHourPriceChange: null,
    fiveMinuteVolumeUsd: value.fiveMinuteVolumeUsd,
    precedingOneHourVolumeUsd: null,
    fiveMinuteBuyTransactions: value.fiveMinuteBuys,
    fiveMinuteSellTransactions: value.fiveMinuteSells,
    fiveMinuteUniqueBuyers: null,
    largestBuyerVolumePercentage: null,
    currentExecutablePriceUsd: value.priceUsd,
    fiveMinuteExecutableHighUsd: null,
    confirmingWalletVolumeWeightedEntryUsd:
      weightedEntry(purchases) === null ? null : asDecimal(weightedEntry(purchases)!),
  });
}

/** Acquires one live market/security instant and binds it to reconstructed wallet evidence. */
export class LiveCandidateEvaluationFactSource implements CandidateEvaluationFactSource {
  public constructor(
    private readonly market: MarketObservationPort,
    private readonly security: MintSecurityObservationPort,
    private readonly purchases: CandidateWalletPurchaseSource,
    private readonly confirmations: WalletIntelligenceRepository,
    private readonly now: () => Timestamp,
  ) {}

  public async load(lease: CandidateEvaluationLease) {
    const evaluatedAt = this.now();
    const [marketResult, security, purchases] = await Promise.all([
      this.market.observePrimaryPool(lease.mint, evaluatedAt),
      this.security.observe(lease.mint, new Set<string>(), evaluatedAt),
      this.purchases.load(lease.candidateId),
    ]);
    if (!marketResult.ok)
      throw new Error(`Candidate market evidence unavailable: ${marketResult.error.code}`);
    if (marketResult.value.priceUsd === null || marketResult.value.priceUsd.lte(0))
      throw new Error("Candidate confirmation requires a positive market price");
    if (marketResult.value.liquidityUsd === null || marketResult.value.liquidityUsd.lte(0))
      throw new Error("Candidate confirmation requires positive market liquidity");
    const walletConfirmation = await confirmAndPersistWallets({
      confirmationId: lease.evaluationRunId,
      candidateId: lease.candidateId,
      facts: {
        evaluatedAt,
        currentPriceUsd: marketResult.value.priceUsd,
        poolLiquidityUsd: marketResult.value.liquidityUsd,
        purchases,
      },
      repository: this.confirmations,
    });
    return Object.freeze({
      evaluatedAt,
      security,
      market: marketSnapshot(marketResult.value, evaluatedAt, purchases),
      walletConfirmation,
    });
  }
}

export function deterministicSignalId(lease: CandidateEvaluationLease): SignalId {
  const hex = createHash("sha256").update(lease.evaluationRunId).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}` as SignalId;
}
