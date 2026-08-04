import { InvariantViolationError } from "../shared/errors.js";
import type {
  CandidateId,
  EvidenceId,
  MintAddress,
  ProviderId,
  StrategyVersionId,
  Timestamp,
  TokenId,
} from "../shared/types.js";

export type CandidateState =
  | "discovered"
  | "normalizing"
  | "evaluating"
  | "rejected"
  | "eligible"
  | "approval_pending"
  | "expired"
  | "converted";

export interface CandidateSource {
  readonly provider: ProviderId;
  readonly sourceReference: string;
  readonly observedAt: Timestamp;
  readonly evidenceId: EvidenceId;
}

export interface Candidate {
  readonly id: CandidateId;
  readonly tokenId: TokenId;
  readonly mint: MintAddress;
  readonly activeDedupKey: string;
  readonly state: CandidateState;
  readonly firstSeenAt: Timestamp;
  readonly strategyVersionId: StrategyVersionId;
}

export interface DiscoveredCandidateInput extends Candidate {
  readonly source: CandidateSource;
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

/** Validates the immutable identity recorded when a candidate first enters the system. */
export function createDiscoveredCandidate(
  input: DiscoveredCandidateInput,
): DiscoveredCandidateInput {
  requireText(input.mint, "Candidate mint");
  requireText(input.activeDedupKey, "Candidate deduplication key");
  requireText(input.source.sourceReference, "Candidate source reference");
  if (input.state !== "discovered")
    throw new InvariantViolationError("A newly discovered candidate must be discovered");
  if (input.source.observedAt > input.firstSeenAt)
    throw new InvariantViolationError("Candidate source cannot follow first-seen time");
  return Object.freeze({ ...input, source: Object.freeze({ ...input.source }) });
}
