import { describe, expect, it, vi } from "vitest";

import {
  producePositionRuntimeFacts,
  RuntimeFactFragmentProducer,
} from "../../src/application/services/runtime-fact-producers.js";
import { asTimestamp, asUuid, type PositionId } from "../../src/domain/shared/types.js";
import type { PositionObservationInput } from "../../src/infrastructure/database/position-observations.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000003001");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const checkpoint = {
  positionId,
  revision: 7n,
  runtimeState: { pendingExit: null },
} as never;

describe("runtime fact producers", () => {
  it("creates deterministic revision-bound immutable observations", async () => {
    const ingest = vi.fn(async () => ({ contentHash: "a".repeat(64) }));
    const producer = new RuntimeFactFragmentProducer({ ingest });
    const snapshot = {
      kind: "market" as const,
      provider: "dexscreener" as const,
      sourceKey: "pair:one",
      observedAt,
      phase: "monitor" as const,
      facts: { stepId: "monitor-7" },
    };
    const first = await producer.produce(checkpoint, snapshot);
    const second = await producer.produce(checkpoint, snapshot);
    expect(first).toBe(second);
    expect(ingest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: first,
        positionId,
        kind: "market",
        payload: {
          schemaVersion: 1,
          checkpointRevision: "7",
          phase: "monitor",
          facts: { stepId: "monitor-7" },
        },
      }),
    );
  });

  it("fails before persistence when a monitoring authority is absent", async () => {
    const producer = new RuntimeFactFragmentProducer({ ingest: vi.fn() });
    const source = (kind: "market" | "chain" | "wallet" | "security") => ({
      collect: async () => ({
        kind,
        provider: "solana_rpc" as const,
        sourceKey: kind,
        observedAt,
        phase: "monitor" as const,
        facts: { stepId: kind },
      }),
    });
    await expect(
      producePositionRuntimeFacts({
        checkpoint,
        observedAt,
        producer,
        sources: [source("market"), source("chain"), source("wallet"), source("security")],
      }),
    ).rejects.toThrow(/missing execution/);
  });

  it("persists a complete producer cycle in deterministic source order", async () => {
    const ingest = vi.fn(async (_input: PositionObservationInput) => ({
      contentHash: "b".repeat(64),
    }));
    const producer = new RuntimeFactFragmentProducer({ ingest });
    const kinds = ["market", "chain", "wallet", "security", "execution"] as const;
    await producePositionRuntimeFacts({
      checkpoint,
      observedAt,
      producer,
      sources: kinds.map((kind) => ({
        collect: async () => ({
          kind,
          provider: "solana_rpc" as const,
          sourceKey: kind,
          observedAt,
          phase: "monitor" as const,
          facts: { [`${kind}Ready`]: true } as never,
        }),
      })),
    });
    expect(ingest.mock.calls.map(([input]) => input.kind)).toEqual(kinds);
  });
});
