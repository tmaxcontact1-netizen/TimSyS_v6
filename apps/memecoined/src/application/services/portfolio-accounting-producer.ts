import { createHash } from "node:crypto";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import { asUuid, type DecimalValue, type Timestamp } from "../../domain/shared/types.js";

export interface PortfolioAccountingObservation {
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly equitySol: DecimalValue;
  readonly uncommittedSol: DecimalValue;
  readonly openCostExposureSol: DecimalValue;
  readonly liquidityCapacitySol: DecimalValue;
  readonly estimatedEntryCostsSol: DecimalValue;
  readonly openPositionCount: bigint;
  readonly cumulativeRealizedPnlSol: DecimalValue;
  readonly executableUnrealizedLossSol: DecimalValue;
  readonly consecutiveClosedLosingTrades: bigint;
  readonly reconciliationFailuresLast24Hours: bigint;
  readonly unauthorizedTransactionDetected: boolean;
  readonly authoritativeDisagreementDurationMs: bigint;
  readonly usesLeverageOrBorrowing: boolean;
}

export interface PortfolioAccountingCheckpoint extends PortfolioAccountingObservation {
  readonly id: string;
}

export interface PortfolioAccountingObservationSource {
  observe(requestedAt: Timestamp): Promise<PortfolioAccountingObservation>;
}

export interface PortfolioAccountingCheckpointSink {
  record(checkpoint: PortfolioAccountingCheckpoint): Promise<void>;
}

function canonical(input: PortfolioAccountingObservation): string {
  return JSON.stringify({
    observedAt: input.observedAt,
    evidence: [...input.evidence]
      .map((item) => ({
        id: item.id,
        provider: item.provider,
        observedAt: item.observedAt,
        sourceKey: item.sourceKey,
        ...(item.slot === undefined ? {} : { slot: item.slot.toString() }),
        ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    equitySol: input.equitySol.toString(),
    uncommittedSol: input.uncommittedSol.toString(),
    openCostExposureSol: input.openCostExposureSol.toString(),
    liquidityCapacitySol: input.liquidityCapacitySol.toString(),
    estimatedEntryCostsSol: input.estimatedEntryCostsSol.toString(),
    openPositionCount: input.openPositionCount.toString(),
    cumulativeRealizedPnlSol: input.cumulativeRealizedPnlSol.toString(),
    executableUnrealizedLossSol: input.executableUnrealizedLossSol.toString(),
    consecutiveClosedLosingTrades: input.consecutiveClosedLosingTrades.toString(),
    reconciliationFailuresLast24Hours: input.reconciliationFailuresLast24Hours.toString(),
    unauthorizedTransactionDetected: input.unauthorizedTransactionDetected,
    authoritativeDisagreementDurationMs: input.authoritativeDisagreementDurationMs.toString(),
    usesLeverageOrBorrowing: input.usesLeverageOrBorrowing,
  });
}

export function deterministicPortfolioCheckpointId(
  observation: PortfolioAccountingObservation,
): string {
  const hex = createHash("sha256").update(canonical(observation)).digest("hex");
  return asUuid(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

function validateObservation(
  requestedAt: Timestamp,
  observation: PortfolioAccountingObservation,
): void {
  if (observation.observedAt !== requestedAt)
    throw new InvariantViolationError(
      "Portfolio accounting observation must match the requested instant",
    );
  if (observation.evidence.length === 0)
    throw new InvariantViolationError("Portfolio accounting observation requires evidence");
  if (new Set(observation.evidence.map((item) => item.id)).size !== observation.evidence.length)
    throw new InvariantViolationError("Portfolio accounting evidence must be unique");
  if (observation.evidence.some((item) => item.observedAt > requestedAt))
    throw new InvariantViolationError(
      "Portfolio accounting evidence cannot postdate the observation",
    );
  if (observation.uncommittedSol.gt(observation.equitySol))
    throw new InvariantViolationError("Uncommitted SOL cannot exceed equity");
  if (observation.liquidityCapacitySol.gt(observation.equitySol))
    throw new InvariantViolationError("Liquidity capacity cannot exceed equity");
  if (
    observation.openPositionCount === 0n &&
    (!observation.openCostExposureSol.isZero() || !observation.executableUnrealizedLossSol.isZero())
  )
    throw new InvariantViolationError("A flat portfolio cannot contain open-position exposure");
  if (observation.usesLeverageOrBorrowing)
    throw new InvariantViolationError(
      "Portfolio accounting cannot authorize leverage or borrowing",
    );
}

export async function producePortfolioAccountingCheckpoint(input: {
  readonly source: PortfolioAccountingObservationSource;
  readonly sink: PortfolioAccountingCheckpointSink;
  readonly observedAt: Timestamp;
}): Promise<PortfolioAccountingCheckpoint> {
  const observation = await input.source.observe(input.observedAt);
  validateObservation(input.observedAt, observation);
  const checkpoint = Object.freeze({
    ...observation,
    evidence: Object.freeze([...observation.evidence]),
    id: deterministicPortfolioCheckpointId(observation),
  });
  await input.sink.record(checkpoint);
  return checkpoint;
}
