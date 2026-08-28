import { createHash } from "node:crypto";

import type { ChainObservationPort, ChainTransactionObservationPort } from "../ports/chain.js";
import type { PositionOpeningRepository } from "../ports/repositories.js";
import type { MintSecurityObservationPort } from "../ports/runtime-authority-inputs.js";
import type { ObservationTrace } from "../contracts/observations.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asRawAmount,
  asUuid,
  type AuditEventId,
  type MintAddress,
  type OrderId,
  type PositionId,
  type RawAmount,
  type Timestamp,
  type TokenId,
  type WalletAddress,
} from "../../domain/shared/types.js";
import { evaluateSuccessfulEntry } from "../../domain/trading/order.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";
import { openReconciledPosition } from "./execution.js";

export interface EntryTrackedWalletBaseline {
  readonly wallet: WalletAddress;
  readonly tier: "tier_a" | "tier_b";
  readonly independentGroupId: string | null;
}

export interface LiveEntryReconciliationWork {
  readonly orderId: OrderId;
  readonly tokenId: TokenId;
  readonly wallet: WalletAddress;
  readonly mint: MintAddress;
  readonly signature: string;
  readonly minimumOutputAmount: RawAmount;
  readonly walletConfirmation: "tier_a" | "two_tier_b";
  readonly trackedWallets: readonly EntryTrackedWalletBaseline[];
}

function uuid<T>(...parts: readonly string[]): T {
  const hex = createHash("sha256").update(parts.join("\0")).digest("hex");
  return asUuid(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`) as T;
}

function evidence(trace: ObservationTrace): EvidenceReference {
  return Object.freeze({
    id: trace.evidenceId, provider: trace.provider, observedAt: trace.respondedAt,
    sourceKey: trace.sourceKey, contentHash: trace.contentHash,
    ...(trace.slot === undefined ? {} : { slot: trace.slot }),
  });
}

function selectedWallets(work: LiveEntryReconciliationWork): readonly EntryTrackedWalletBaseline[] {
  if (work.walletConfirmation === "tier_a") {
    const wallet = work.trackedWallets.find(({ tier }) => tier === "tier_a");
    if (wallet === undefined) throw new InvariantViolationError("Tier A confirmation baseline is missing");
    return [wallet];
  }
  const selected: EntryTrackedWalletBaseline[] = [];
  for (const wallet of work.trackedWallets.filter(({ tier }) => tier === "tier_b")) {
    if (wallet.independentGroupId === null) continue;
    if (selected.every((item) => item.independentGroupId !== wallet.independentGroupId)) selected.push(wallet);
    if (selected.length === 2) return selected;
  }
  throw new InvariantViolationError("Two independent Tier B confirmation baselines are required");
}

export async function reconcileLiveEntry(input: {
  readonly work: LiveEntryReconciliationWork;
  readonly transactions: ChainTransactionObservationPort;
  readonly balances: ChainObservationPort;
  readonly security: MintSecurityObservationPort;
  readonly positions: PositionOpeningRepository;
  readonly now: () => Timestamp;
}): Promise<boolean> {
  const requestedAt = input.now();
  const transactionResult = await input.transactions.observeTransaction(
    input.work.signature, input.work.wallet, input.work.mint, requestedAt,
  );
  if (!transactionResult.ok)
    throw new Error(`Entry transaction reconciliation unavailable: ${transactionResult.error.reason}`);
  const transaction = transactionResult.value;
  if (transaction.state === "pending") return false;
  const evaluatedAt = input.now();
  const tokenIncrease = transaction.tokenBalanceBeforeRaw !== null && transaction.tokenBalanceAfterRaw !== null
    && transaction.tokenBalanceAfterRaw >= transaction.tokenBalanceBeforeRaw
    ? asRawAmount(transaction.tokenBalanceAfterRaw - transaction.tokenBalanceBeforeRaw) : null;
  const solDecrease = transaction.nativeBalanceBeforeLamports !== null && transaction.nativeBalanceAfterLamports !== null
    && transaction.nativeBalanceBeforeLamports >= transaction.nativeBalanceAfterLamports
    ? asRawAmount(transaction.nativeBalanceBeforeLamports - transaction.nativeBalanceAfterLamports) : null;
  const reconciliation = Object.freeze({
    evaluatedAt,
    transactionConfirmed: transaction.state === "confirmed",
    onChainError: transaction.onChainError,
    tokenBalanceIncrease: tokenIncrease,
    solBalanceDecrease: solDecrease,
    feePaid: transaction.feeLamports,
    tipPaid: transaction.tipLamports,
    minimumOutputAmount: input.work.minimumOutputAmount,
    signature: transaction.signature,
    evidence: Object.freeze(transaction.traces.map(evidence)),
  });
  const decision = evaluateSuccessfulEntry(reconciliation);
  if (!decision.successfulEntry)
    throw new InvariantViolationError(`Submitted entry did not reconcile: ${decision.failedRuleIds.join(",")}`);

  const selected = selectedWallets(input.work);
  const [entrySecurity, ...walletObservations] = await Promise.all([
    input.security.observe(input.work.mint, new Set<string>(), evaluatedAt),
    ...selected.map(async ({ wallet }) => {
      const result = await input.balances.observeBalances(wallet, input.work.mint, evaluatedAt);
      if (!result.ok) throw new Error(`Tracked-wallet entry baseline unavailable: ${result.error.reason}`);
      return result.value;
    }),
  ]);
  const tracked = selected.map((wallet, index) => Object.freeze({
    wallet: wallet.wallet,
    entryBalanceRaw: walletObservations[index]!.tokenBalanceRaw,
  }));
  const baselineEvidence = Object.freeze([
    ...entrySecurity.evidence,
    ...walletObservations.flatMap((item) => item.traces.map(evidence)),
  ]);
  const positionId = uuid<PositionId>("position", input.work.orderId);
  await openReconciledPosition({
    positionId,
    tokenId: input.work.tokenId,
    entryOrderId: input.work.orderId,
    openedEventId: uuid<AuditEventId>("position-opened", input.work.orderId),
    reconciliation,
    authorityBaseline: Object.freeze({
      capturedAt: evaluatedAt,
      wallet: input.work.wallet,
      tokenMint: input.work.mint,
      settlementMint: WRAPPED_SOL_MINT,
      developerRelated: Object.freeze([]),
      originatingTierA: input.work.walletConfirmation === "tier_a" ? tracked[0]! : null,
      confirmingTierB: input.work.walletConfirmation === "two_tier_b"
        ? Object.freeze([tracked[0]!, tracked[1]!]) as readonly [typeof tracked[number], typeof tracked[number]]
        : null,
      excludedHolderTokenAccounts: new Set<string>(),
      entrySecurity,
      history: Object.freeze({
        liquidityUsdTenMinutesAgo: null,
        priorFullExitPriceImpactPercentages: Object.freeze([]),
        marketDataUnavailableSince: null,
        allChainAccessUnavailableSince: null,
        evidence: baselineEvidence,
      }),
    }),
  }, input.positions);
  return true;
}
