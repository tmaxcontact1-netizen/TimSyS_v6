import type { CandidateEvaluationInput } from "../../domain/candidate/evaluator.js";
import type { SignalId, Timestamp } from "../../domain/shared/types.js";
import type {
  CandidateEvaluationLease,
  CandidateEvaluationRepository,
  CandidateEvaluationWorkQueue,
} from "../ports/repositories.js";
import { evaluateAndPersistCandidate } from "./candidate-pipeline.js";

export interface CandidateEvaluationFactSource {
  load(lease: CandidateEvaluationLease): Promise<CandidateEvaluationInput>;
}

/** Evaluates only fully hydrated leased work; acquisition failure returns authority to the queue. */
export async function runLeasedCandidateEvaluationCycle(input: {
  readonly queue: CandidateEvaluationWorkQueue;
  readonly facts: CandidateEvaluationFactSource;
  readonly repository: CandidateEvaluationRepository;
  readonly ownerId: string;
  readonly now: () => Timestamp;
  readonly leaseExpiresAt: (now: Timestamp) => Timestamp;
  readonly retryAt: (now: Timestamp) => Timestamp;
  readonly signalId: (lease: CandidateEvaluationLease) => SignalId;
  readonly batchSize?: number;
}): Promise<number> {
  const now = input.now();
  const leases = await input.queue.claim({
    ownerId: input.ownerId,
    now,
    leaseExpiresAt: input.leaseExpiresAt(now),
    limit: input.batchSize ?? 25,
  });
  let completed = 0;
  for (const lease of leases) {
    try {
      const facts = await input.facts.load(lease);
      await evaluateAndPersistCandidate({
        candidateId: lease.candidateId,
        evaluationRunId: lease.evaluationRunId,
        signalId: input.signalId(lease),
        facts,
        repository: input.repository,
        leaseOwner: lease.leaseOwner,
      });
      completed += 1;
    } catch (error) {
      await input.queue.retry({
        lease,
        availableAt: input.retryAt(input.now()),
        reason: error instanceof Error ? error.message : "Unknown candidate evaluation failure",
      });
    }
  }
  return completed;
}
