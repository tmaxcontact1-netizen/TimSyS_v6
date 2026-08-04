import { describe, expect, it } from "vitest";

import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
  replayPositionEvents,
  restorePositionLifecycle,
  type PositionEvent,
  type PositionLifecycle,
} from "../../src/domain/trading/position.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type OrderId,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000061");
const tokenId = asUuid<TokenId>("00000000-0000-4000-8000-000000000062");
const entryOrderId = asUuid<OrderId>("00000000-0000-4000-8000-000000000063");
const eventId = (suffix: string): AuditEventId =>
  asUuid<AuditEventId>(`00000000-0000-4000-8000-${suffix.padStart(12, "0")}`);

const events = Object.freeze([
  Object.freeze({
    type: "position:opened" as const,
    eventId: eventId("71"),
    positionId,
    aggregateVersion: 0n,
    occurredAt: asTimestamp("2026-08-04T12:00:00.000Z"),
    tokenId,
    entryOrderId,
    acquiredAmount: asRawAmount(1_000n),
    costBasisSol: asNonNegativeDecimal(10),
  }),
  Object.freeze({
    type: "position:executable-peak-recorded" as const,
    eventId: eventId("72"),
    positionId,
    aggregateVersion: 1n,
    occurredAt: asTimestamp("2026-08-04T12:01:00.000Z"),
    executableValueSol: asNonNegativeDecimal(13),
  }),
  Object.freeze({
    type: "position:exit-requested" as const,
    eventId: eventId("73"),
    positionId,
    aggregateVersion: 2n,
    occurredAt: asTimestamp("2026-08-04T12:02:00.000Z"),
  }),
  Object.freeze({
    type: "position:exit-reconciled" as const,
    eventId: eventId("74"),
    positionId,
    aggregateVersion: 3n,
    occurredAt: asTimestamp("2026-08-04T12:02:01.000Z"),
    target: "first" as const,
    soldAmount: asRawAmount(400n),
    proceedsSol: asNonNegativeDecimal(5),
    reconciledRemainingAmount: asRawAmount(600n),
  }),
  Object.freeze({
    type: "position:exit-requested" as const,
    eventId: eventId("75"),
    positionId,
    aggregateVersion: 4n,
    occurredAt: asTimestamp("2026-08-04T12:03:00.000Z"),
  }),
  Object.freeze({
    type: "position:exit-reconciled" as const,
    eventId: eventId("76"),
    positionId,
    aggregateVersion: 5n,
    occurredAt: asTimestamp("2026-08-04T12:03:01.000Z"),
    target: "full" as const,
    soldAmount: asRawAmount(600n),
    proceedsSol: asNonNegativeDecimal(8),
    reconciledRemainingAmount: asRawAmount(0n),
  }),
] satisfies readonly PositionEvent[]);

function applyLive(input: readonly PositionEvent[]): PositionLifecycle {
  let lifecycle = createEmptyPositionLifecycle();
  for (const event of input) lifecycle = applyPositionEvent(lifecycle, event);
  return lifecycle;
}

function eventAt(index: number): PositionEvent {
  const event = events[index];
  if (event === undefined) throw new Error(`Missing test event at index ${index}`);
  return event;
}

describe("deterministic position lifecycle replay", () => {
  it("produces identical state through live application and full replay", () => {
    const live = applyLive(events);
    const replayed = replayPositionEvents(events);
    expect(replayed).toEqual(live);
    expect(replayed.position?.state).toBe("closed");
    expect(replayed.position?.realisedPnlSol.toString()).toBe("3");
    expect(replayed.version).toBe(5n);
  });

  it("continues from a validated checkpoint with the same final state as full replay", () => {
    const checkpoint = restorePositionLifecycle(replayPositionEvents(events.slice(0, 4)));
    const restarted = events.slice(4).reduce(applyPositionEvent, checkpoint);
    expect(restarted).toEqual(replayPositionEvents(events));
  });

  it("treats an already-applied event ID as an idempotent no-op", () => {
    const lifecycle = replayPositionEvents(events.slice(0, 2));
    const duplicate = applyPositionEvent(lifecycle, eventAt(1));
    expect(duplicate).toEqual(lifecycle);
    expect(duplicate.version).toBe(1n);
    expect(duplicate.appliedEvents).toHaveLength(2);
  });

  it("rejects changed content reused under an applied event ID", () => {
    const lifecycle = replayPositionEvents(events.slice(0, 2));
    const peakEvent = eventAt(1);
    if (peakEvent.type !== "position:executable-peak-recorded")
      throw new Error("Expected executable-peak test event");
    expect(() =>
      applyPositionEvent(lifecycle, {
        ...peakEvent,
        executableValueSol: asNonNegativeDecimal(14),
      }),
    ).toThrow("reused with different content");
  });

  it("rejects a reused version under a different event identity", () => {
    const lifecycle = replayPositionEvents(events.slice(0, 2));
    expect(() => applyPositionEvent(lifecycle, { ...eventAt(1), eventId: eventId("77") })).toThrow(
      "next aggregate version",
    );
  });

  it("rejects gaps and out-of-order event versions", () => {
    expect(() => replayPositionEvents([eventAt(0), eventAt(2)])).toThrow("next aggregate version");
    expect(() => replayPositionEvents([eventAt(1), eventAt(0)])).toThrow("next aggregate version");
  });

  it("rejects backwards event time and cross-position events", () => {
    const lifecycle = replayPositionEvents(events.slice(0, 1));
    expect(() =>
      applyPositionEvent(lifecycle, {
        ...eventAt(1),
        occurredAt: asTimestamp("2026-08-04T11:59:59.000Z"),
      }),
    ).toThrow("time cannot move backwards");
    expect(() =>
      applyPositionEvent(lifecycle, {
        ...eventAt(1),
        positionId: asUuid<PositionId>("00000000-0000-4000-8000-000000000099"),
      }),
    ).toThrow("different aggregate");
  });

  it("rejects invalid persisted lifecycle checkpoints", () => {
    const lifecycle = replayPositionEvents(events.slice(0, 2));
    expect(() => restorePositionLifecycle({ ...lifecycle, version: 2n })).toThrow(
      "match position version",
    );
    expect(() =>
      restorePositionLifecycle({
        ...lifecycle,
        appliedEvents: Object.freeze([...lifecycle.appliedEvents, lifecycle.appliedEvents[1]!]),
      }),
    ).toThrow("must be unique");
    expect(() =>
      restorePositionLifecycle({
        ...lifecycle,
        lastEventAt: asTimestamp("2026-08-04T12:01:01.000Z"),
      }),
    ).toThrow("must match position update");
  });

  it("freezes lifecycle state and its applied-event inventory", () => {
    const lifecycle = replayPositionEvents(events);
    expect(Object.isFrozen(lifecycle)).toBe(true);
    expect(Object.isFrozen(lifecycle.appliedEvents)).toBe(true);
    expect(Object.isFrozen(lifecycle.appliedEvents[0])).toBe(true);
    expect(Object.isFrozen(lifecycle.position)).toBe(true);
  });
});
