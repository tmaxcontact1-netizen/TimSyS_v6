import { describe, expect, it, vi } from "vitest";

import {
  runLivePositionRuntimeFactCycle,
  runPositionRuntimeFactPublisherCycle,
} from "../../src/application/services/runtime-fact-publisher.js";
import { RuntimeFactFragmentProducer } from "../../src/application/services/runtime-fact-producers.js";
import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
} from "../../src/domain/shared/types.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000002101");
const observationId = asUuid<EvidenceId>("00000000-0000-4000-8000-000000002102");
const now = asTimestamp("2026-08-04T12:00:02.000Z");

describe("runtime fact publisher worker", () => {
  it("loads the current checkpoint, aggregates matching evidence, and publishes once", async () => {
    const checkpoint = {
      positionId,
      revision: 3n,
      runtimeState: { pendingExit: null },
    } as never;
    let published: unknown;
    const publish = vi.fn(async (input: unknown) => {
      published = input;
    });
    const result = await runPositionRuntimeFactPublisherCycle(positionId, {
      checkpoints: { load: vi.fn(async () => checkpoint) } as never,
      observations: {
        listRuntimeFactObservations: vi.fn(async () => [
          {
            id: observationId,
            positionId,
            observedAt: asTimestamp("2026-08-04T12:00:01.000Z"),
            payload: {
              schemaVersion: 1,
              checkpointRevision: "3",
              phase: "monitor",
              facts: { stepId: "monitor-3" },
            },
          },
        ]),
      },
      publications: { publish },
      now: () => now,
    });
    expect(result).toMatchObject({ positionId, checkpointRevision: 3n, phase: "monitor" });
    expect(publish).toHaveBeenCalledOnce();
    expect(published).toMatchObject({
      checkpoint,
      phase: "monitor",
      observationIds: [observationId],
      facts: { stepId: "monitor-3" },
    });
  });

  it("selects reconciliation from acknowledged pending-exit state", async () => {
    const checkpoint = {
      positionId,
      revision: 4n,
      runtimeState: { pendingExit: { submission: { signature: "signature" } } },
    } as never;
    const result = await runPositionRuntimeFactPublisherCycle(positionId, {
      checkpoints: { load: async () => checkpoint } as never,
      observations: {
        listRuntimeFactObservations: async () => [
          {
            id: observationId,
            positionId,
            observedAt: now,
            payload: {
              schemaVersion: 1,
              checkpointRevision: "4",
              phase: "reconcile",
              facts: { stepId: "reconcile-4" },
            },
          },
        ],
      },
      publications: { publish: async () => undefined },
      now: () => now,
    });
    expect(result.phase).toBe("reconcile");
  });

  it("produces every monitoring authority before publishing the same revision", async () => {
    const checkpoint = {
      positionId,
      revision: 6n,
      runtimeState: { pendingExit: null },
    } as never;
    const ingested: string[] = [];
    const kinds = ["market", "chain", "wallet", "security", "execution"] as const;
    const observations = kinds.map((kind, index) => ({
      id: asUuid<EvidenceId>(`00000000-0000-4000-8000-0000000022${10 + index}`),
      positionId,
      observedAt: now,
      payload: {
        schemaVersion: 1,
        checkpointRevision: "6",
        phase: "monitor",
        facts: { [kind]: true },
      },
    }));
    const result = await runLivePositionRuntimeFactCycle(positionId, {
      checkpoints: { load: vi.fn(async () => checkpoint) } as never,
      producer: new RuntimeFactFragmentProducer({
        ingest: vi.fn(async (input) => {
          ingested.push(input.kind);
          return { contentHash: "a".repeat(64) };
        }),
      }),
      monitoringSources: kinds.map((kind) => ({
        collect: async () => ({
          kind,
          provider: "solana_rpc" as const,
          sourceKey: kind,
          observedAt: now,
          phase: "monitor" as const,
          facts: { [kind]: true } as never,
        }),
      })),
      reconciliationSources: [],
      observations: { listRuntimeFactObservations: async () => observations },
      publications: { publish: vi.fn(async () => undefined) },
      now: () => now,
    });
    expect(ingested).toEqual(kinds);
    expect(result.checkpointRevision).toBe(6n);
  });
});
