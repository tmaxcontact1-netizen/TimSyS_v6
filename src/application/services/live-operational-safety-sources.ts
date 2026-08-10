import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asDecimal,
  type DecimalValue,
  type PositionId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import type {
  PortfolioOperationalSafetyInputSource,
  PositionSafetyObservation,
  ProviderHealthObservation,
  ReconciliationSafetyObservation,
} from "./portfolio-operational-safety-production.js";

export interface OpenPositionSafetyFact {
  readonly positionId: PositionId;
  readonly remainingCostBasisSol: DecimalValue;
  readonly executableValueSol: DecimalValue;
  readonly reservedEntryCostSol: DecimalValue;
  readonly evidence: readonly EvidenceReference[];
}

export interface OpenPositionSafetyFactSource {
  observeOpenPositions(requestedAt: Timestamp): Promise<
    Readonly<{
      wallet: WalletAddress;
      observedAt: Timestamp;
      liquidNativeSol: DecimalValue;
      usesLeverageOrBorrowing: boolean;
      positions: readonly OpenPositionSafetyFact[];
      evidence: readonly EvidenceReference[];
    }>
  >;
}

export interface ReconciliationFailureFactSource {
  observeFailures(requestedAt: Timestamp): Promise<ReconciliationSafetyObservation>;
}

export interface ProviderDisagreementFactSource {
  observeHealth(requestedAt: Timestamp): Promise<ProviderHealthObservation>;
}

function requireAuthority(
  authority: { readonly wallet: WalletAddress; readonly observedAt: Timestamp },
  wallet: WalletAddress,
  requestedAt: Timestamp,
): void {
  if (authority.wallet !== wallet)
    throw new InvariantViolationError("Operational safety authority targets another wallet");
  if (authority.observedAt !== requestedAt)
    throw new InvariantViolationError("Operational safety authority is not same-instant");
}

/** Aggregates complete per-position valuation and durable health facts for publication. */
export class LivePortfolioOperationalSafetyInputSource implements PortfolioOperationalSafetyInputSource {
  public constructor(
    private readonly wallet: WalletAddress,
    private readonly positions: OpenPositionSafetyFactSource,
    private readonly reconciliation: ReconciliationFailureFactSource,
    private readonly providers: ProviderDisagreementFactSource,
  ) {}

  public async observePositions(requestedAt: Timestamp): Promise<PositionSafetyObservation> {
    const observation = await this.positions.observeOpenPositions(requestedAt);
    requireAuthority(observation, this.wallet, requestedAt);
    if (observation.evidence.length === 0)
      throw new InvariantViolationError("Position inventory requires authority evidence");
    if (
      new Set(observation.positions.map(({ positionId }) => positionId)).size !==
      observation.positions.length
    )
      throw new InvariantViolationError("Open position inventory contains duplicate positions");
    const evidence = [...observation.evidence];
    let cost = asDecimal("0");
    let loss = asDecimal("0");
    let reserved = asDecimal("0");
    for (const position of observation.positions) {
      if (position.evidence.length === 0)
        throw new InvariantViolationError("Every open position requires executable evidence");
      if (position.remainingCostBasisSol.isNegative() || position.executableValueSol.isNegative())
        throw new InvariantViolationError("Open position values must be non-negative");
      if (position.reservedEntryCostSol.isNegative())
        throw new InvariantViolationError("Reserved entry costs must be non-negative");
      cost = cost.add(position.remainingCostBasisSol) as DecimalValue;
      const downside = position.remainingCostBasisSol.sub(position.executableValueSol);
      loss = loss.add(downside.isPositive() ? downside : 0) as DecimalValue;
      reserved = reserved.add(position.reservedEntryCostSol) as DecimalValue;
      evidence.push(...position.evidence);
    }
    if (new Set(evidence.map(({ id }) => id)).size !== evidence.length)
      throw new InvariantViolationError("Position safety evidence must be unique");
    return Object.freeze({
      wallet: this.wallet,
      observedAt: requestedAt,
      evidence: Object.freeze(evidence),
      openCostExposureSol: cost,
      liquidityCapacitySol: observation.liquidNativeSol,
      estimatedEntryCostsSol: reserved,
      openPositionCount: BigInt(observation.positions.length),
      executableUnrealizedLossSol: loss,
      usesLeverageOrBorrowing: observation.usesLeverageOrBorrowing,
    });
  }

  public async observeReconciliation(
    requestedAt: Timestamp,
  ): Promise<ReconciliationSafetyObservation> {
    const observation = await this.reconciliation.observeFailures(requestedAt);
    requireAuthority(observation, this.wallet, requestedAt);
    return observation;
  }

  public async observeProviderHealth(requestedAt: Timestamp): Promise<ProviderHealthObservation> {
    const observation = await this.providers.observeHealth(requestedAt);
    requireAuthority(observation, this.wallet, requestedAt);
    return observation;
  }
}
