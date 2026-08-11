import type { Timestamp } from "../../domain/shared/types.js";

export interface PortfolioProductionLease {
  readonly ownerId: string;
  readonly observedAt: Timestamp;
}

export interface PortfolioProductionSchedule {
  claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
  }): Promise<PortfolioProductionLease | null>;
  complete(input: {
    readonly lease: PortfolioProductionLease;
    readonly availableAt: Timestamp;
  }): Promise<void>;
  retry(input: {
    readonly lease: PortfolioProductionLease;
    readonly availableAt: Timestamp;
    readonly reason: string;
  }): Promise<void>;
}

/** Owns one complete, cross-process leased portfolio publication and risk cycle. */
export async function runScheduledPortfolioProductionCycle(input: {
  readonly schedule: PortfolioProductionSchedule;
  readonly ownerId: string;
  readonly now: () => Timestamp;
  readonly leaseExpiresAt: (at: Timestamp) => Timestamp;
  readonly nextAvailableAt: (at: Timestamp) => Timestamp;
  readonly retryAt: (at: Timestamp) => Timestamp;
  readonly publish: (observedAt: Timestamp) => Promise<void>;
  readonly evaluateRisk: () => Promise<number>;
}): Promise<Readonly<{ status: "locked" | "completed" | "retry_scheduled"; evaluated: number }>> {
  const now = input.now();
  const lease = await input.schedule.claim({
    ownerId: input.ownerId,
    now,
    leaseExpiresAt: input.leaseExpiresAt(now),
  });
  if (lease === null) return Object.freeze({ status: "locked", evaluated: 0 });
  try {
    await input.publish(lease.observedAt);
    const evaluated = await input.evaluateRisk();
    await input.schedule.complete({ lease, availableAt: input.nextAvailableAt(lease.observedAt) });
    return Object.freeze({ status: "completed", evaluated });
  } catch (error) {
    await input.schedule.retry({
      lease,
      availableAt: input.retryAt(input.now()),
      reason: error instanceof Error ? error.message : String(error),
    });
    return Object.freeze({ status: "retry_scheduled", evaluated: 0 });
  }
}
