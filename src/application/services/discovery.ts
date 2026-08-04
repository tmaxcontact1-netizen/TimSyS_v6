import { createDiscoveredCandidate, type CandidateSource } from "../../domain/candidate/model.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type {
  CandidateId,
  MintAddress,
  StrategyVersionId,
  Timestamp,
  TokenId,
} from "../../domain/shared/types.js";
import type {
  CandidateDiscoveryRepository,
  CandidateDiscoveryResult,
} from "../ports/repositories.js";

export interface CandidateDiscoveryHint {
  readonly candidateId: CandidateId;
  readonly tokenId: TokenId;
  readonly mint: MintAddress;
  readonly strategyVersionId: StrategyVersionId;
  readonly deduplicationWindow: string;
  readonly discoveredAt: Timestamp;
  readonly source: CandidateSource;
}

export function candidateDeduplicationKey(input: {
  readonly mint: MintAddress;
  readonly strategyVersionId: StrategyVersionId;
  readonly window: string;
}): string {
  const window = input.window.trim();
  if (window.length === 0) throw new InvariantViolationError("Discovery window is required");
  return `${input.strategyVersionId}:${input.mint}:${window}`;
}

/** Records one normalized hint without allowing source retries to duplicate evaluation work. */
export async function discoverCandidate(
  hint: CandidateDiscoveryHint,
  repository: CandidateDiscoveryRepository,
): Promise<CandidateDiscoveryResult> {
  if (hint.source.observedAt > hint.discoveredAt)
    throw new InvariantViolationError("Discovery evidence cannot be from the future");
  return repository.recordDiscovery(
    createDiscoveredCandidate({
      id: hint.candidateId,
      tokenId: hint.tokenId,
      mint: hint.mint,
      activeDedupKey: candidateDeduplicationKey({
        mint: hint.mint,
        strategyVersionId: hint.strategyVersionId,
        window: hint.deduplicationWindow,
      }),
      state: "discovered",
      firstSeenAt: hint.discoveredAt,
      strategyVersionId: hint.strategyVersionId,
      source: hint.source,
    }),
  );
}
