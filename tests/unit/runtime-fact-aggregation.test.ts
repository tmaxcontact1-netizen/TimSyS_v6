import { describe, expect, it } from "vitest";

import { aggregatePositionRuntimeFacts } from "../../src/application/services/runtime-fact-aggregation.js";
import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
} from "../../src/domain/shared/types.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000002001");
const first = asUuid<EvidenceId>("00000000-0000-4000-8000-000000002002");
const second = asUuid<EvidenceId>("00000000-0000-4000-8000-000000002003");
const checkpoint = { positionId, revision: 7n } as never;

function observation(
  id: EvidenceId,
  observedAt: string,
  facts: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    positionId,
    observedAt: asTimestamp(observedAt),
    payload: {
      schemaVersion: 1,
      checkpointRevision: "7",
      phase: "monitor",
      facts,
      ...overrides,
    },
  };
}

describe("runtime fact aggregation", () => {
  it("merges revision-bound fragments deterministically and lets newer facts supersede", () => {
    const observations = [
      observation(second, "2026-08-04T12:00:02.000Z", { liquidity: "20" }),
      observation(first, "2026-08-04T12:00:01.000Z", { liquidity: "10", wallet: "owner" }),
    ];
    const result = aggregatePositionRuntimeFacts({
      checkpoint,
      phase: "monitor",
      evaluatedAt: asTimestamp("2026-08-04T12:00:03.000Z"),
      observations,
    });
    expect(result.facts).toEqual({ liquidity: "20", wallet: "owner" });
    expect(result.observationIds).toEqual([first, second]);
    expect(
      aggregatePositionRuntimeFacts({
        checkpoint,
        phase: "monitor",
        evaluatedAt: asTimestamp("2026-08-04T12:00:03.000Z"),
        observations: [...observations].reverse(),
      }).id,
    ).toBe(result.id);
  });

  it("ignores other revisions and phases but requires one matching fragment", () => {
    expect(() =>
      aggregatePositionRuntimeFacts({
        checkpoint,
        phase: "monitor",
        evaluatedAt: asTimestamp("2026-08-04T12:00:03.000Z"),
        observations: [
          observation(
            first,
            "2026-08-04T12:00:01.000Z",
            { value: 1 },
            {
              checkpointRevision: "6",
            },
          ),
        ],
      }),
    ).toThrow(/No observations match/);
  });

  it("unions cross-source provenance without changing ordinary field semantics", () => {
    const marketEvidence = { id: "market", provider: "dexscreener" };
    const executionEvidence = { id: "execution", provider: "solana_rpc" };
    const result = aggregatePositionRuntimeFacts({
      checkpoint,
      phase: "monitor",
      evaluatedAt: asTimestamp("2026-08-04T12:00:03.000Z"),
      observations: [
        observation(first, "2026-08-04T12:00:02.000Z", { evidence: [marketEvidence] }),
        observation(second, "2026-08-04T12:00:02.000Z", {
          evidence: [marketEvidence, executionEvidence],
        }),
      ],
    });
    expect(result.facts).toEqual({ evidence: [marketEvidence, executionEvidence] });
  });

  it("rejects future evidence and contradictory simultaneous values", () => {
    expect(() =>
      aggregatePositionRuntimeFacts({
        checkpoint,
        phase: "monitor",
        evaluatedAt: asTimestamp("2026-08-04T12:00:01.000Z"),
        observations: [observation(first, "2026-08-04T12:00:02.000Z", { value: 1 })],
      }),
    ).toThrow(/future/);
    expect(() =>
      aggregatePositionRuntimeFacts({
        checkpoint,
        phase: "monitor",
        evaluatedAt: asTimestamp("2026-08-04T12:00:03.000Z"),
        observations: [
          observation(first, "2026-08-04T12:00:02.000Z", { value: 1 }),
          observation(second, "2026-08-04T12:00:02.000Z", { value: 2 }),
        ],
      }),
    ).toThrow(/contradictory/);
  });
});
