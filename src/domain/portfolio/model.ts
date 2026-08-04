import { InvariantViolationError } from "../shared/errors.js";
import type { EvidenceReference } from "../shared/evidence.js";
import type { DecimalValue, MintAddress, Percentage, Timestamp } from "../shared/types.js";

export interface PortfolioSnapshot {
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly mint: MintAddress;
  readonly equitySol: DecimalValue | null;
  readonly uncommittedSol: DecimalValue | null;
  readonly openCostExposureSol: DecimalValue | null;
  readonly liquidityCapacitySol: DecimalValue | null;
  readonly estimatedEntryCostsSol: DecimalValue | null;
  readonly openPositionCount: bigint | null;
  readonly hasNonClosedPositionForMint: boolean | null;
  readonly hasConfirmedPriorClosure: boolean | null;
  readonly lastConfirmedClosureAt: Timestamp | null;
  readonly usesLeverageOrBorrowing: boolean | null;
  readonly increasesLosingPosition: boolean | null;
  readonly requestedPositionPercentage: Percentage | null;
}

function requireNonNegative(value: DecimalValue | null, name: string): void {
  if (value !== null && value.isNegative()) {
    throw new InvariantViolationError(`${name} must be non-negative`);
  }
}

export function createPortfolioSnapshot(input: PortfolioSnapshot): PortfolioSnapshot {
  requireNonNegative(input.equitySol, "Equity");
  requireNonNegative(input.uncommittedSol, "Uncommitted SOL");
  requireNonNegative(input.openCostExposureSol, "Open cost exposure");
  requireNonNegative(input.liquidityCapacitySol, "Liquidity capacity");
  requireNonNegative(input.estimatedEntryCostsSol, "Estimated entry costs");

  if (input.openPositionCount !== null && input.openPositionCount < 0n) {
    throw new InvariantViolationError("Open position count must be non-negative");
  }
  if (input.evidence.length === 0) {
    throw new InvariantViolationError("Portfolio snapshot requires source evidence");
  }
  if (input.hasConfirmedPriorClosure === false && input.lastConfirmedClosureAt !== null) {
    throw new InvariantViolationError("Closure timestamp requires a confirmed prior closure");
  }
  if (input.hasConfirmedPriorClosure === true && input.lastConfirmedClosureAt === null) {
    throw new InvariantViolationError("Confirmed prior closure requires its timestamp");
  }
  if (
    input.equitySol !== null &&
    input.uncommittedSol !== null &&
    input.uncommittedSol.gt(input.equitySol)
  ) {
    throw new InvariantViolationError("Uncommitted SOL cannot exceed equity");
  }

  return Object.freeze({ ...input, evidence: Object.freeze([...input.evidence]) });
}
