import type { CandidateEvaluationRepository } from "../ports/repositories.js";
import {
  evaluateCandidate,
  type CandidateEvaluationInput,
  type CandidateEvaluationDecision,
} from "../../domain/candidate/evaluator.js";
import type { CandidateId, SignalId } from "../../domain/shared/types.js";

export async function evaluateAndPersistCandidate(input: {
  readonly candidateId: CandidateId;
  readonly evaluationRunId: string;
  readonly signalId: SignalId;
  readonly facts: CandidateEvaluationInput;
  readonly repository: CandidateEvaluationRepository;
}): Promise<CandidateEvaluationDecision> {
  if (input.evaluationRunId.trim().length === 0)
    throw new TypeError("Evaluation run ID is required");
  const decision = evaluateCandidate(input.facts);
  await input.repository.saveEvaluation({
    candidateId: input.candidateId,
    evaluationRunId: input.evaluationRunId,
    signalId: decision.eligible ? input.signalId : null,
    evaluatedAt: input.facts.evaluatedAt,
    decision,
  });
  return decision;
}
