import { describe, expect, it } from "vitest";

import { asTimestamp } from "../../src/domain/shared/types.js";
import type { SignedTransaction } from "../../src/application/ports/signer.js";
import { HeliusSubmissionError } from "../../src/infrastructure/providers/helius/client.js";
import { HeliusSubmissionAdapter } from "../../src/infrastructure/providers/helius/submission-adapter.js";

const transaction: SignedTransaction = Object.freeze({
  serializedTransactionBase64: Buffer.from("signed").toString("base64"),
  unsignedTransactionFingerprint: "unsigned",
  signedTransactionFingerprint: "signed",
  signature: "signature-1",
  wallet: "Wallet111111111111111111111111111111111111" as never,
});
const acknowledgedAt = asTimestamp("2026-08-04T13:00:00Z");

describe("Helius submission", () => {
  it("returns acknowledgement without claiming confirmation", async () => {
    const adapter = new HeliusSubmissionAdapter({
      send: async () => ({ body: { signature: "signature-1" }, receivedAt: acknowledgedAt }),
    });
    await expect(adapter.submit(transaction, "delivery-1")).resolves.toEqual({
      provider: "helius",
      signature: "signature-1",
      acknowledgedAt,
    });
  });

  it("deduplicates an acknowledged delivery", async () => {
    let sends = 0;
    const adapter = new HeliusSubmissionAdapter({
      send: async () => {
        sends += 1;
        return { body: { result: "signature-1" }, receivedAt: acknowledgedAt };
      },
    });
    await adapter.submit(transaction, "delivery-1");
    await adapter.submit(transaction, "delivery-1");
    expect(sends).toBe(1);
  });

  it("rejects delivery collisions", async () => {
    const adapter = new HeliusSubmissionAdapter({
      send: async () => ({ body: { result: "signature-1" }, receivedAt: acknowledgedAt }),
    });
    await adapter.submit(transaction, "delivery-1");
    await expect(
      adapter.submit({ ...transaction, signedTransactionFingerprint: "different" }, "delivery-1"),
    ).rejects.toThrow("reused");
  });

  it.each([
    [{ body: {}, receivedAt: acknowledgedAt }, "malformed"],
    [{ body: { result: "different" }, receivedAt: acknowledgedAt }, "rejected"],
  ])("rejects invalid acknowledgements", async (response, code) => {
    const adapter = new HeliusSubmissionAdapter({ send: async () => response });
    await expect(adapter.submit(transaction, "delivery-1")).rejects.toMatchObject({ code });
  });

  it("classifies transport failure as retryable unavailability", async () => {
    const adapter = new HeliusSubmissionAdapter({
      send: async () => {
        throw new Error("offline");
      },
    });
    await expect(adapter.submit(transaction, "delivery-1")).rejects.toEqual(
      new HeliusSubmissionError("unavailable", true, "Helius Sender is unavailable"),
    );
  });
});
