import { describe, expect, it } from "vitest";

import {
  deriveMonitoringExecutionAuthority,
  deriveReconciliationExecutionAuthority,
} from "../../src/application/services/execution-runtime-authority.js";
import {
  asTimestamp,
  asUuid,
  type PositionId,
  type TokenId,
} from "../../src/domain/shared/types.js";
import type { PositionWorkerCheckpoint } from "../../src/application/ports/repositories.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000004101");
const tokenId = asUuid<TokenId>("00000000-0000-4000-8000-000000004102");
const observedAt = asTimestamp("2026-08-04T12:00:00.000Z");
const context = { wallet: "wallet", tokenMint: "mint", settlementMint: "settlement" } as never;
const monitoring = {
  positionId,
  revision: 7n,
  runtimeState: {
    pendingExit: null,
    lifecycle: { position: { id: positionId, tokenId } },
  },
} as PositionWorkerCheckpoint;

describe("execution runtime authority", () => {
  it("derives stable monitoring identities from the checkpoint revision", () => {
    const input = {
      checkpoint: monitoring,
      context,
      observedAt,
      history: {
        liquidityUsdTenMinutesAgo: null,
        priorFullExitPriceImpactPercentages: [],
        marketDataUnavailableSince: null,
        allChainAccessUnavailableSince: null,
        evidence: [],
      },
    } as const;
    const first = deriveMonitoringExecutionAuthority(input);
    const second = deriveMonitoringExecutionAuthority(input);
    expect(first).toEqual(second);
    expect(first.stepId).toBe(`monitor:${positionId}:7`);
    expect(first.positionId).toBe(positionId);
    expect(first.tokenId).toBe(tokenId);
  });

  it("binds reconciliation identity to the acknowledged signature", () => {
    const checkpoint = {
      ...monitoring,
      runtimeState: {
        ...monitoring.runtimeState,
        pendingExit: { submission: { signature: "signature-a" } },
      },
    } as never;
    const facts = deriveReconciliationExecutionAuthority({ checkpoint, context, observedAt });
    expect(facts.stepId).toContain("signature-a");
    expect(facts.wallet).toBe("wallet");
  });

  it("refuses reconciliation before submission acknowledgement", () => {
    const checkpoint = {
      ...monitoring,
      runtimeState: { ...monitoring.runtimeState, pendingExit: { submission: null } },
    } as never;
    expect(() =>
      deriveReconciliationExecutionAuthority({ checkpoint, context, observedAt }),
    ).toThrow(/acknowledged signature/);
  });
});
