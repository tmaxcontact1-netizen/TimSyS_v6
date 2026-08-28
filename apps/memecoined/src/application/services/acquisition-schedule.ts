import type { Timestamp } from "../../domain/shared/types.js";

export interface AcquisitionLease {
  readonly ownerId: string;
  readonly startedAt: Timestamp;
}

export interface AcquisitionSchedule {
  claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
  }): Promise<AcquisitionLease | null>;
  complete(input: {
    readonly lease: AcquisitionLease;
    readonly availableAt: Timestamp;
    readonly summary: AcquisitionCycleSummary;
  }): Promise<void>;
  retry(input: {
    readonly lease: AcquisitionLease;
    readonly availableAt: Timestamp;
    readonly failedStage: AcquisitionStage;
    readonly reason: string;
  }): Promise<void>;
}

export type AcquisitionStage =
  | "discovery"
  | "wallet_observation"
  | "wallet_valuation"
  | "candidate_evaluation"
  | "portfolio_risk";

export interface AcquisitionCycleSummary {
  readonly discovered: number;
  readonly sourcesAdded: number;
  readonly candidatesEvaluated: number;
  readonly riskEvaluated: number;
}

export type AcquisitionCycleResult = Readonly<
  | { status: "locked"; summary: AcquisitionCycleSummary }
  | { status: "completed"; summary: AcquisitionCycleSummary }
  | { status: "retry_scheduled"; failedStage: AcquisitionStage; summary: AcquisitionCycleSummary }
>;

const empty = (): AcquisitionCycleSummary =>
  Object.freeze({ discovered: 0, sourcesAdded: 0, candidatesEvaluated: 0, riskEvaluated: 0 });

/** Runs one leased acquisition chain in dependency order and fails the whole cycle closed. */
export async function runScheduledAcquisitionCycle(input: {
  readonly schedule: AcquisitionSchedule;
  readonly ownerId: string;
  readonly now: () => Timestamp;
  readonly leaseExpiresAt: (at: Timestamp) => Timestamp;
  readonly nextAvailableAt: (at: Timestamp) => Timestamp;
  readonly retryAt: (at: Timestamp) => Timestamp;
  readonly discover: () => Promise<Readonly<{ candidatesCreated: number; sourcesAdded: number }>>;
  readonly observeWallets: () => Promise<unknown>;
  readonly valueWallets: () => Promise<unknown>;
  readonly evaluateCandidates: () => Promise<number>;
  readonly publishPortfolioAndEvaluateRisk: () => Promise<number>;
}): Promise<AcquisitionCycleResult> {
  const startedAt = input.now();
  const lease = await input.schedule.claim({
    ownerId: input.ownerId,
    now: startedAt,
    leaseExpiresAt: input.leaseExpiresAt(startedAt),
  });
  if (lease === null) return Object.freeze({ status: "locked", summary: empty() });
  let stage: AcquisitionStage = "discovery";
  const summary = { discovered: 0, sourcesAdded: 0, candidatesEvaluated: 0, riskEvaluated: 0 };
  try {
    const discovery = await input.discover();
    summary.discovered = discovery.candidatesCreated;
    summary.sourcesAdded = discovery.sourcesAdded;
    stage = "wallet_observation";
    await input.observeWallets();
    stage = "wallet_valuation";
    await input.valueWallets();
    stage = "candidate_evaluation";
    summary.candidatesEvaluated = await input.evaluateCandidates();
    stage = "portfolio_risk";
    summary.riskEvaluated = await input.publishPortfolioAndEvaluateRisk();
    const completed = Object.freeze({ ...summary });
    await input.schedule.complete({
      lease,
      availableAt: input.nextAvailableAt(lease.startedAt),
      summary: completed,
    });
    return Object.freeze({ status: "completed", summary: completed });
  } catch (error) {
    await input.schedule.retry({
      lease,
      availableAt: input.retryAt(input.now()),
      failedStage: stage,
      reason: error instanceof Error ? error.message : String(error),
    });
    return Object.freeze({
      status: "retry_scheduled",
      failedStage: stage,
      summary: Object.freeze({ ...summary }),
    });
  }
}
