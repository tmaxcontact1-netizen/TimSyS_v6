import { describe, expect, it, vi } from "vitest";

import {
  PostgresProviderDisagreementAuthority,
  PostgresReconciliationFailureFactSource,
} from "../../src/infrastructure/database/operational-safety-facts.js";
import { asTimestamp, asUuid } from "../../src/domain/shared/types.js";
import type { EvidenceId, WalletAddress } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");
const wallet = "wallet" as WalletAddress;
const proof = Object.freeze({
  id: asUuid<EvidenceId>("11111111-1111-4111-8111-111111111111"),
  provider: "solana_rpc" as const,
  observedAt: at,
  sourceKey: "provider-read",
});

describe("durable operational safety facts", () => {
  it("reconstructs the rolling reconciliation failure count", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ failures: "2", latest_at: at }], rowCount: 1 });
    const source = new PostgresReconciliationFailureFactSource({ query }, wallet);
    await expect(source.observeFailures(at)).resolves.toMatchObject({ failuresLast24Hours: 2n });
    expect(query.mock.calls[0]?.[1]).toEqual(["2026-08-09T12:00:00.000Z", at]);
  });

  it("preserves one continuous disagreement interval and resolves it explicitly", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const authority = new PostgresProviderDisagreementAuthority({ query }, wallet);
    await authority.record({
      authorityKey: "wallet-inventory",
      wallet,
      observedAt: at,
      agrees: false,
      evidence: [proof],
    });
    await authority.record({
      authorityKey: "wallet-inventory",
      wallet,
      observedAt: at,
      agrees: true,
      evidence: [proof],
    });
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT");
    expect(query.mock.calls[1]?.[0]).toContain("resolved_at=$3");
  });

  it("reconstructs disagreement duration from the earliest open interval", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ began_at: "2026-08-10T11:59:58.000Z", opening_evidence_json: [proof] }],
      rowCount: 1,
    });
    const authority = new PostgresProviderDisagreementAuthority({ query }, wallet);
    await expect(authority.observeHealth(at)).resolves.toMatchObject({
      authoritativeDisagreementDurationMs: 2000n,
    });
  });
});
