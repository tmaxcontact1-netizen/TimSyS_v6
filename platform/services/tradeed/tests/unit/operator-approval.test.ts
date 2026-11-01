import { describe, expect, it, vi } from "vitest";

import {
  OperatorApprovalService,
  operatorApprovalPayloadHash,
} from "../../src/application/services/operator-approval.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-27T12:00:00.000Z");

describe("operator approval authority", () => {
  it("canonically binds an entry to its exact payload, eligibility and quote for fifteen seconds", async () => {
    const store = { request: vi.fn(), decide: vi.fn(), consume: vi.fn(), expireDue: vi.fn() };
    const service = new OperatorApprovalService(store, () => at);
    const request = await service.request({
      actionType: "entry",
      targetType: "signal",
      targetId: "signal-1",
      payload: { amount: 25n, mint: "mint" },
      eligibilityHash: "eligibility",
      quoteFingerprint: "quote",
      requestedBy: "worker",
    });
    expect(request.expiresAt).toBe("2026-08-27T12:00:15.000Z");
    expect(request.nonce).not.toBe(request.nonceHash);
    expect(request.payloadHash).toBe(operatorApprovalPayloadHash({ mint: "mint", amount: 25n }));
    expect(store.request).toHaveBeenCalledWith(request);
  });

  it("hashes the one-time nonce before every decision and consumption", async () => {
    const store = { request: vi.fn(), decide: vi.fn(), consume: vi.fn(), expireDue: vi.fn() };
    const service = new OperatorApprovalService(store, () => at);
    await service.decide({ id: "approval", nonce: "secret-nonce", decision: "approve", actorId: "me" });
    await service.consume({
      id: "approval", payload: { amount: "1" },
      eligibilityHash: "eligible", quoteFingerprint: "quote", actorId: "executor",
    });
    expect(store.decide.mock.calls[0]?.[0].nonceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.consume.mock.calls[0]?.[0]).not.toHaveProperty("nonceHash");
  });

  it("requires quote identity for entry approval", async () => {
    const service = new OperatorApprovalService(
      { request: vi.fn(), decide: vi.fn(), consume: vi.fn(), expireDue: vi.fn() }, () => at,
    );
    await expect(service.request({
      actionType: "entry", targetType: "signal", targetId: "signal-1", payload: {},
      eligibilityHash: "eligible", requestedBy: "worker",
    })).rejects.toThrow(/quote fingerprint/);
  });
});
