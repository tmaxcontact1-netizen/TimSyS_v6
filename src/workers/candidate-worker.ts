import type {
  CandidateEvaluationInput,
  CandidateEvaluationDecision,
} from "../domain/candidate/evaluator.js";
import type { CandidateId, SignalId } from "../domain/shared/types.js";
import type { CandidateEvaluationRepository } from "../application/ports/repositories.js";
import { evaluateAndPersistCandidate } from "../application/services/candidate-pipeline.js";

export interface CandidateEvaluationWork {
  readonly candidateId: CandidateId;
  readonly evaluationRunId: string;
  readonly signalId: SignalId;
  readonly facts: CandidateEvaluationInput;
}

export async function runCandidateWorkerCycle(dependencies: {
  readonly source: { nextBatch(): Promise<readonly CandidateEvaluationWork[]> };
  readonly repository: CandidateEvaluationRepository;
  readonly batchSize?: number;
}): Promise<readonly CandidateEvaluationDecision[]> {
  const limit = dependencies.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Candidate batch size must be between 1 and 1000");
  const work = await dependencies.source.nextBatch();
  if (work.length > limit)
    throw new RangeError("Candidate source exceeded the requested batch size");
  const results: CandidateEvaluationDecision[] = [];
  for (const item of work)
    results.push(
      await evaluateAndPersistCandidate({ ...item, repository: dependencies.repository }),
    );
  return Object.freeze(results);
}
