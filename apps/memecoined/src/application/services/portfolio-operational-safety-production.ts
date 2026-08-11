import { createHash } from "node:crypto";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asUuid,
  type DecimalValue,
  type EvidenceId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import type { PortfolioOperationalSafetyObservation } from "./live-portfolio-accounting-observation.js";

interface AuthorityObservation {
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
}

export interface PositionSafetyObservation extends AuthorityObservation {
  readonly openCostExposureSol: DecimalValue;
  readonly liquidityCapacitySol: DecimalValue;
  readonly estimatedEntryCostsSol: DecimalValue;
  readonly openPositionCount: bigint;
  readonly executableUnrealizedLossSol: DecimalValue;
  readonly usesLeverageOrBorrowing: boolean;
}

export interface ReconciliationSafetyObservation extends AuthorityObservation {
  readonly failuresLast24Hours: bigint;
}

export interface ProviderHealthObservation extends AuthorityObservation {
  readonly authoritativeDisagreementDurationMs: bigint;
}

export interface PortfolioOperationalSafetyInputSource {
  observePositions(requestedAt: Timestamp): Promise<PositionSafetyObservation>;
  observeReconciliation(requestedAt: Timestamp): Promise<ReconciliationSafetyObservation>;
  observeProviderHealth(requestedAt: Timestamp): Promise<ProviderHealthObservation>;
}

export interface PortfolioOperationalSafetySink {
  record(input: PortfolioOperationalSafetyObservation & { readonly id: EvidenceId }): Promise<void>;
}

function validateAuthority(
  authority: AuthorityObservation,
  wallet: WalletAddress,
  requestedAt: Timestamp,
): void {
  if (authority.wallet !== wallet)
    throw new InvariantViolationError("Operational safety input targets another wallet");
  if (authority.observedAt !== requestedAt)
    throw new InvariantViolationError("Operational safety inputs must share one instant");
  if (authority.evidence.length === 0)
    throw new InvariantViolationError("Operational safety input requires evidence");
  if (authority.evidence.some(({ observedAt }) => observedAt > requestedAt))
    throw new InvariantViolationError("Operational safety evidence cannot be postdated");
}

function deterministicId(input: {
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
}): EvidenceId {
  const canonical = JSON.stringify({
    wallet: input.wallet,
    observedAt: input.observedAt,
    evidence: [...input.evidence]
      .map(({ id, provider, observedAt, sourceKey, slot, contentHash }) => ({
        id,
        provider,
        observedAt,
        sourceKey,
        ...(slot === undefined ? {} : { slot: slot.toString() }),
        ...(contentHash === undefined ? {} : { contentHash }),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
  const hex = createHash("sha256").update(canonical).digest("hex");
  return asUuid<EvidenceId>(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

/** Joins independent live safety authorities and publishes one immutable observation. */
export async function producePortfolioOperationalSafety(input: {
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
  readonly source: PortfolioOperationalSafetyInputSource;
  readonly sink: PortfolioOperationalSafetySink;
}): Promise<PortfolioOperationalSafetyObservation & { readonly id: EvidenceId }> {
  const [positions, reconciliation, providers] = await Promise.all([
    input.source.observePositions(input.observedAt),
    input.source.observeReconciliation(input.observedAt),
    input.source.observeProviderHealth(input.observedAt),
  ]);
  for (const authority of [positions, reconciliation, providers])
    validateAuthority(authority, input.wallet, input.observedAt);
  const evidence = Object.freeze([
    ...positions.evidence,
    ...reconciliation.evidence,
    ...providers.evidence,
  ]);
  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length)
    throw new InvariantViolationError("Operational safety evidence must be unique");
  if (positions.openPositionCount < 0n || reconciliation.failuresLast24Hours < 0n)
    throw new InvariantViolationError("Operational safety counters must be non-negative");
  if (providers.authoritativeDisagreementDurationMs < 0n)
    throw new InvariantViolationError("Provider disagreement duration must be non-negative");
  if (positions.executableUnrealizedLossSol.gt(positions.openCostExposureSol))
    throw new InvariantViolationError("Executable loss cannot exceed open cost exposure");
  if (
    positions.openPositionCount === 0n &&
    (!positions.openCostExposureSol.isZero() || !positions.executableUnrealizedLossSol.isZero())
  )
    throw new InvariantViolationError("Flat operational safety authority cannot contain exposure");

  const observation = Object.freeze({
    id: deterministicId({ wallet: input.wallet, observedAt: input.observedAt, evidence }),
    wallet: input.wallet,
    observedAt: input.observedAt,
    evidence,
    openCostExposureSol: positions.openCostExposureSol,
    liquidityCapacitySol: positions.liquidityCapacitySol,
    estimatedEntryCostsSol: positions.estimatedEntryCostsSol,
    openPositionCount: positions.openPositionCount,
    executableUnrealizedLossSol: positions.executableUnrealizedLossSol,
    reconciliationFailuresLast24Hours: reconciliation.failuresLast24Hours,
    authoritativeDisagreementDurationMs: providers.authoritativeDisagreementDurationMs,
    usesLeverageOrBorrowing: positions.usesLeverageOrBorrowing,
  });
  await input.sink.record(observation);
  return observation;
}
