import type { RiskDecisionRepository } from "../ports/repositories.js";
import type { SignalId } from "../../domain/shared/types.js";
import type { PortfolioSnapshot } from "../../domain/portfolio/model.js";
import type { CircuitBreakerSnapshot } from "../../domain/portfolio/breakers.js";
import { assessEntryRisk, type RiskAssessment } from "./risk-monitor.js";

export async function assessAndPersistEntry(input: {
  readonly signalId: SignalId;
  readonly riskRunId: string;
  readonly portfolio: PortfolioSnapshot;
  readonly breakers: CircuitBreakerSnapshot;
  readonly repository: RiskDecisionRepository;
}): Promise<RiskAssessment> {
  if (input.riskRunId.trim().length === 0) throw new TypeError("Risk run ID is required");
  const assessment = assessEntryRisk(input);
  await input.repository.saveRiskDecision({
    signalId: input.signalId,
    riskRunId: input.riskRunId,
    evaluatedAt: input.portfolio.observedAt,
    sizing: assessment.sizing,
    breakers: assessment.breakers,
  });
  return assessment;
}
