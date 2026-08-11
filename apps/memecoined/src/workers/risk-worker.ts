import type { PortfolioSnapshot } from "../domain/portfolio/model.js";
import type { CircuitBreakerSnapshot } from "../domain/portfolio/breakers.js";
import type { SignalId } from "../domain/shared/types.js";
import type { RiskDecisionRepository } from "../application/ports/repositories.js";
import { assessAndPersistEntry } from "../application/services/entry-planner.js";
import type { RiskAssessment } from "../application/services/risk-monitor.js";

export interface RiskWork {
  readonly signalId: SignalId;
  readonly riskRunId: string;
  readonly portfolio: PortfolioSnapshot;
  readonly breakers: CircuitBreakerSnapshot;
}

export async function runRiskWorkerCycle(dependencies: {
  readonly source: { nextBatch(): Promise<readonly RiskWork[]> };
  readonly repository: RiskDecisionRepository;
  readonly batchSize?: number;
}): Promise<readonly RiskAssessment[]> {
  const limit = dependencies.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Risk batch size must be between 1 and 1000");
  const work = await dependencies.source.nextBatch();
  if (work.length > limit) throw new RangeError("Risk source exceeded the requested batch size");
  const results: RiskAssessment[] = [];
  for (const item of work)
    results.push(await assessAndPersistEntry({ ...item, repository: dependencies.repository }));
  return Object.freeze(results);
}
