import { Decimal } from "decimal.js";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asDecimal,
  type DecimalValue,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

export interface RealizedPositionTransaction {
  readonly id: string;
  readonly occurredAt: Timestamp;
  readonly realizedPnlDeltaSol: DecimalValue;
  readonly closesPosition: boolean;
  readonly evidence: EvidenceReference;
}

export interface WalletInitiatedTransaction {
  readonly signature: string;
  readonly occurredAt: Timestamp;
  readonly successful: boolean;
  readonly evidence: EvidenceReference;
}

export interface PortfolioTransactionHistoryObservation {
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
  readonly coverageStartedAt: Timestamp;
  readonly systemActivityStartedAt: Timestamp;
  readonly realizations: readonly RealizedPositionTransaction[];
  readonly walletInitiatedTransactions: readonly WalletInitiatedTransaction[];
  readonly authorizedSignatures: readonly string[];
}

export interface PortfolioTransactionHistorySource {
  observe(requestedAt: Timestamp): Promise<PortfolioTransactionHistoryObservation>;
}

export interface WalletHistoryTransactionObservation extends WalletInitiatedTransaction {
  readonly slot: bigint;
}

export interface WalletHistoryPage {
  readonly wallet: WalletAddress;
  readonly requestedAt: Timestamp;
  readonly coverageStartedAt: Timestamp;
  readonly transactions: readonly WalletHistoryTransactionObservation[];
  readonly evidenceObservedAt: Timestamp;
}

export interface WalletHistoryObservationPort {
  observe(input: {
    readonly wallet: WalletAddress;
    readonly coverageRequiredAt: Timestamp;
    readonly requestedAt: Timestamp;
  }): Promise<WalletHistoryPage>;
}

export interface ClassifiedPortfolioTransactionHistory {
  readonly observedAt: Timestamp;
  readonly wallet: WalletAddress;
  readonly cumulativeRealizedPnlSol: DecimalValue;
  readonly consecutiveClosedLosingTrades: bigint;
  readonly unauthorizedTransactionDetected: boolean;
  readonly evidence: readonly EvidenceReference[];
}

const milliseconds = (value: Timestamp): number => new Date(value).getTime();

function ordered<T extends { readonly occurredAt: Timestamp; readonly id?: string }>(
  values: readonly T[],
): readonly T[] {
  return [...values].sort(
    (left, right) =>
      milliseconds(left.occurredAt) - milliseconds(right.occurredAt) ||
      (left.id ?? "").localeCompare(right.id ?? ""),
  );
}

/** Derives accounting safety facts only from complete, signature-bound transaction history. */
export async function classifyPortfolioTransactionHistory(input: {
  readonly source: PortfolioTransactionHistorySource;
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
}): Promise<ClassifiedPortfolioTransactionHistory> {
  const observation = await input.source.observe(input.observedAt);
  if (observation.wallet !== input.wallet)
    throw new InvariantViolationError("Transaction history returned a mismatched wallet");
  if (observation.observedAt !== input.observedAt)
    throw new InvariantViolationError("Transaction history must match the requested instant");
  if (
    milliseconds(observation.coverageStartedAt) > milliseconds(observation.systemActivityStartedAt)
  )
    throw new InvariantViolationError("Transaction history does not cover all system activity");

  const realizations = ordered(observation.realizations);
  const walletTransactions = ordered(observation.walletInitiatedTransactions);
  const all = [...realizations, ...walletTransactions];
  if (all.some((item) => milliseconds(item.occurredAt) > milliseconds(input.observedAt)))
    throw new InvariantViolationError("Transaction history cannot contain future activity");
  if (new Set(realizations.map(({ id }) => id)).size !== realizations.length)
    throw new InvariantViolationError("Realization identities must be unique");
  if (
    new Set(walletTransactions.map(({ signature }) => signature)).size !== walletTransactions.length
  )
    throw new InvariantViolationError("Wallet transaction signatures must be unique");
  if (observation.authorizedSignatures.some((signature) => signature.trim().length === 0))
    throw new InvariantViolationError("Authorized signatures cannot be empty");
  const authorized = new Set(observation.authorizedSignatures);
  if (authorized.size !== observation.authorizedSignatures.length)
    throw new InvariantViolationError("Authorized signatures must be unique");

  let cumulative = new Decimal(0);
  let losingStreak = 0n;
  for (const realization of realizations) {
    cumulative = cumulative.plus(realization.realizedPnlDeltaSol);
    if (realization.closesPosition)
      losingStreak = realization.realizedPnlDeltaSol.isNegative() ? losingStreak + 1n : 0n;
  }
  const unauthorized = walletTransactions.some(
    ({ signature, successful }) => successful && !authorized.has(signature),
  );
  const evidence = all.map(({ evidence }) => evidence);
  if (evidence.length === 0)
    throw new InvariantViolationError("Transaction history requires authoritative evidence");
  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length)
    throw new InvariantViolationError("Transaction history evidence must be unique");
  if (evidence.some(({ observedAt }) => milliseconds(observedAt) > milliseconds(input.observedAt)))
    throw new InvariantViolationError(
      "Transaction history evidence cannot postdate classification",
    );

  return Object.freeze({
    observedAt: input.observedAt,
    wallet: input.wallet,
    cumulativeRealizedPnlSol: asDecimal(cumulative),
    consecutiveClosedLosingTrades: losingStreak,
    unauthorizedTransactionDetected: unauthorized,
    evidence: Object.freeze(evidence),
  });
}
