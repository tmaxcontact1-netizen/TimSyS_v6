import { createHash } from "node:crypto";

import type { CircuitBreakerSnapshot } from "../../domain/portfolio/breakers.js";
import type { PortfolioSnapshot } from "../../domain/portfolio/model.js";
import type { MintAddress, SignalId, Timestamp } from "../../domain/shared/types.js";
import type { RiskDecisionRepository } from "../ports/repositories.js";
import { assessAndPersistEntry } from "./entry-planner.js";

export interface RiskEvaluationLease {
  readonly signalId: SignalId;
  readonly mint: MintAddress;
  readonly leaseOwner: string;
  readonly riskRunId: string;
}

export interface RiskEvaluationWorkQueue {
  claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
    readonly limit: number;
  }): Promise<readonly RiskEvaluationLease[]>;
  retry(input: {
    readonly lease: RiskEvaluationLease;
    readonly availableAt: Timestamp;
    readonly reason: string;
  }): Promise<void>;
}

export interface RiskEvaluationFactSource {
  load(lease: RiskEvaluationLease): Promise<
    Readonly<{
      portfolio: PortfolioSnapshot;
      breakers: CircuitBreakerSnapshot;
    }>
  >;
}

export function deterministicRiskRunId(signalId: SignalId): string {
  return `risk-${createHash("sha256").update(signalId).digest("hex")}`;
}

export async function runLeasedRiskEvaluationCycle(input: {
  readonly queue: RiskEvaluationWorkQueue;
  readonly facts: RiskEvaluationFactSource;
  readonly repository: RiskDecisionRepository;
  readonly ownerId: string;
  readonly now: () => Timestamp;
  readonly leaseExpiresAt: (at: Timestamp) => Timestamp;
  readonly retryAt: (at: Timestamp) => Timestamp;
  readonly batchSize?: number;
}): Promise<number> {
  const limit = input.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Risk batch size must be between 1 and 1000");
  const claimedAt = input.now();
  const leases = await input.queue.claim({
    ownerId: input.ownerId,
    now: claimedAt,
    leaseExpiresAt: input.leaseExpiresAt(claimedAt),
    limit,
  });
  if (leases.length > limit) throw new RangeError("Risk queue exceeded the requested batch size");
  let completed = 0;
  for (const lease of leases) {
    try {
      const facts = await input.facts.load(lease);
      await assessAndPersistEntry({
        signalId: lease.signalId,
        riskRunId: lease.riskRunId,
        portfolio: facts.portfolio,
        breakers: facts.breakers,
        leaseOwner: lease.leaseOwner,
        repository: input.repository,
      });
      completed += 1;
    } catch (error) {
      await input.queue.retry({
        lease,
        availableAt: input.retryAt(input.now()),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return completed;
}
