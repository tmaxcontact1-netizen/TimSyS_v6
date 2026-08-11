import { describe, expect, it, vi } from "vitest";

import {
  runScheduledPortfolioProductionCycle,
  type PortfolioProductionLease,
  type PortfolioProductionSchedule,
} from "../../src/application/services/portfolio-production-schedule.js";
import { asTimestamp, type Timestamp } from "../../src/domain/shared/types.js";

const initial = asTimestamp("2026-08-10T12:00:00.000Z");
const timestampAfter = (at: Timestamp, milliseconds: number) =>
  asTimestamp(new Date(Date.parse(at) + milliseconds).toISOString());

class RecoverableSchedule implements PortfolioProductionSchedule {
  public availableAt = initial;
  public active: PortfolioProductionLease | null = null;
  public completions = 0;
  public retries = 0;

  public async claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
  }): Promise<PortfolioProductionLease | null> {
    if (this.active !== null || input.now < this.availableAt) return null;
    this.active = Object.freeze({ ownerId: input.ownerId, observedAt: input.now });
    return this.active;
  }

  public async complete(input: {
    readonly lease: PortfolioProductionLease;
    readonly availableAt: Timestamp;
  }): Promise<void> {
    expect(input.lease).toBe(this.active);
    this.active = null;
    this.availableAt = input.availableAt;
    this.completions += 1;
  }

  public async retry(input: {
    readonly lease: PortfolioProductionLease;
    readonly availableAt: Timestamp;
    readonly reason: string;
  }): Promise<void> {
    expect(input.lease).toBe(this.active);
    this.active = null;
    this.availableAt = input.availableAt;
    this.retries += 1;
  }
}

function cycle(input: {
  readonly schedule: PortfolioProductionSchedule;
  readonly now: Timestamp;
  readonly publish: (observedAt: Timestamp) => Promise<void>;
  readonly evaluateRisk: () => Promise<number>;
}) {
  return runScheduledPortfolioProductionCycle({
    schedule: input.schedule,
    ownerId: "production-instance",
    now: () => input.now,
    leaseExpiresAt: (at) => timestampAfter(at, 120_000),
    nextAvailableAt: (at) => timestampAfter(at, 30_000),
    retryAt: (at) => timestampAfter(at, 10_000),
    publish: input.publish,
    evaluateRisk: input.evaluateRisk,
  });
}

describe("portfolio production recovery readiness", () => {
  it("recovers from provider degradation on the retry cadence and completes once healthy", async () => {
    const schedule = new RecoverableSchedule();
    const risk = vi.fn(async () => 3);
    await expect(
      cycle({
        schedule,
        now: initial,
        publish: async () => Promise.reject(new Error("both Solana providers unavailable")),
        evaluateRisk: risk,
      }),
    ).resolves.toEqual({ status: "retry_scheduled", evaluated: 0 });
    expect(risk).not.toHaveBeenCalled();

    const retryAt = timestampAfter(initial, 10_000);
    await expect(
      cycle({ schedule, now: retryAt, publish: async () => undefined, evaluateRisk: risk }),
    ).resolves.toEqual({ status: "completed", evaluated: 3 });
    expect(schedule.retries).toBe(1);
    expect(schedule.completions).toBe(1);
    expect(schedule.availableAt).toBe(timestampAfter(retryAt, 30_000));
  });

  it("keeps the cycle unavailable before its durable retry instant", async () => {
    const schedule = new RecoverableSchedule();
    await cycle({
      schedule,
      now: initial,
      publish: async () => Promise.reject(new Error("executable quote unavailable")),
      evaluateRisk: async () => 0,
    });
    const publish = vi.fn(async () => undefined);
    await expect(
      cycle({
        schedule,
        now: timestampAfter(initial, 9_999),
        publish,
        evaluateRisk: async () => 0,
      }),
    ).resolves.toEqual({ status: "locked", evaluated: 0 });
    expect(publish).not.toHaveBeenCalled();
  });

  it("fails closed on stale checkpoint evidence without invoking risk evaluation", async () => {
    const schedule = new RecoverableSchedule();
    const risk = vi.fn(async () => 1);
    await expect(
      cycle({
        schedule,
        now: initial,
        publish: async () => Promise.reject(new Error("Portfolio accounting checkpoint is stale")),
        evaluateRisk: risk,
      }),
    ).resolves.toEqual({ status: "retry_scheduled", evaluated: 0 });
    expect(risk).not.toHaveBeenCalled();
    expect(schedule.active).toBeNull();
  });
});
