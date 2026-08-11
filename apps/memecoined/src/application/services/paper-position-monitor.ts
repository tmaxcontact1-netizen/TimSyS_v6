import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { MintAddress, Timestamp } from "../../domain/shared/types.js";
import type { PaperFill } from "./paper-accounting.js";
import type { PaperQuoteExecutionService } from "./paper-execution.js";

export interface PaperPositionLease {
  readonly tokenMint: MintAddress;
  readonly openAmountRaw: bigint;
  readonly leaseOwner: string;
  readonly leaseAcquiredAt: Timestamp;
}

export interface PaperExitDecision {
  readonly action: "none" | "partial" | "full";
  readonly requestedAmountRaw: bigint;
  readonly evaluatedAt: Timestamp;
  readonly reason: string;
}

export interface PaperPositionWorkQueue {
  claim(input: {
    ownerId: string;
    now: Timestamp;
    leaseExpiresAt: Timestamp;
    limit: number;
  }): Promise<readonly PaperPositionLease[]>;
  complete(input: {
    lease: PaperPositionLease;
    fill: PaperFill | null;
    monitoredAt: Timestamp;
    nextAt: Timestamp;
  }): Promise<void>;
  retry(input: {
    lease: PaperPositionLease;
    availableAt: Timestamp;
    reason: string;
  }): Promise<void>;
}

export interface PaperExitMonitor {
  evaluate(position: PaperPositionLease, at: Timestamp): Promise<PaperExitDecision>;
}

export async function runPaperPositionMonitorCycle(input: {
  queue: PaperPositionWorkQueue;
  monitor: PaperExitMonitor;
  execution: PaperQuoteExecutionService;
  ownerId: string;
  now: () => Timestamp;
  leaseExpiresAt: (at: Timestamp) => Timestamp;
  nextAt: (at: Timestamp) => Timestamp;
  retryAt: (at: Timestamp) => Timestamp;
  batchSize?: number;
}): Promise<readonly PaperFill[]> {
  const limit = input.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Paper position batch size must be between 1 and 1000");
  const claimedAt = input.now();
  const leases = await input.queue.claim({
    ownerId: input.ownerId,
    now: claimedAt,
    leaseExpiresAt: input.leaseExpiresAt(claimedAt),
    limit,
  });
  if (leases.length > limit)
    throw new RangeError("Paper position queue exceeded the requested batch size");
  const fills: PaperFill[] = [];
  for (const lease of leases) {
    try {
      const evaluatedAt = input.now();
      const decision = await input.monitor.evaluate(lease, evaluatedAt);
      if (decision.evaluatedAt < evaluatedAt || decision.reason.trim() === "")
        throw new InvariantViolationError("Paper exit decision lacks matching authority");
      if (decision.action === "none") {
        if (decision.requestedAmountRaw !== 0n)
          throw new InvariantViolationError("No-exit decision cannot request quantity");
        await input.queue.complete({
          lease,
          fill: null,
          monitoredAt: evaluatedAt,
          nextAt: input.nextAt(evaluatedAt),
        });
        continue;
      }
      const amount = decision.action === "full" ? lease.openAmountRaw : decision.requestedAmountRaw;
      if (amount <= 0n || amount > lease.openAmountRaw)
        throw new InvariantViolationError("Paper exit quantity exceeds observed position");
      const fill = await input.execution.execute({
        side: "sell",
        tokenMint: lease.tokenMint,
        inputAmountRaw: amount,
        requestedAt: decision.evaluatedAt,
      });
      await input.queue.complete({
        lease,
        fill,
        monitoredAt: decision.evaluatedAt,
        nextAt: input.nextAt(decision.evaluatedAt),
      });
      fills.push(fill);
    } catch (error) {
      const failedAt = input.now();
      await input.queue.retry({
        lease,
        availableAt: input.retryAt(failedAt),
        reason: error instanceof Error ? error.message : "Unknown paper exit failure",
      });
    }
  }
  return Object.freeze(fills);
}
