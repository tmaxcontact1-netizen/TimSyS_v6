import type { CandidateDiscoveryResult } from "../application/ports/repositories.js";
import {
  discoverCandidate,
  type CandidateDiscoveryHint,
} from "../application/services/discovery.js";
import type { CandidateDiscoveryRepository } from "../application/ports/repositories.js";

export interface DiscoveryWorkerDependencies {
  readonly source: { nextBatch(): Promise<readonly CandidateDiscoveryHint[]> };
  readonly candidates: CandidateDiscoveryRepository;
  readonly batchSize?: number;
}

export interface DiscoveryWorkerCycleResult {
  readonly hintsVisited: number;
  readonly candidatesCreated: number;
  readonly sourcesAdded: number;
  readonly results: readonly CandidateDiscoveryResult[];
}

/** Processes a bounded batch serially so persisted discovery order remains deterministic. */
export async function runDiscoveryWorkerCycle(
  dependencies: DiscoveryWorkerDependencies,
): Promise<DiscoveryWorkerCycleResult> {
  const limit = dependencies.batchSize ?? 100;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Discovery batch size must be between 1 and 1000");
  const hints = await dependencies.source.nextBatch();
  if (hints.length > limit)
    throw new RangeError("Discovery source exceeded the requested batch size");
  const results: CandidateDiscoveryResult[] = [];
  for (const hint of hints) results.push(await discoverCandidate(hint, dependencies.candidates));
  return Object.freeze({
    hintsVisited: hints.length,
    candidatesCreated: results.filter(({ candidateCreated }) => candidateCreated).length,
    sourcesAdded: results.filter(({ sourceAdded }) => sourceAdded).length,
    results: Object.freeze(results),
  });
}
