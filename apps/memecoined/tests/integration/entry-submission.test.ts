import { describe, expect, it } from "vitest";
import type {
  PersistEntrySigning,
  PersistEntrySubmission,
  PreparedEntryExecution,
} from "../../src/application/ports/repositories.js";
import { submitPreparedEntry } from "../../src/application/services/entry-submission.js";
import { PostgresEntrySubmissionRepository } from "../../src/infrastructure/database/entry-submissions.js";
import {
  asTimestamp,
  asUuid,
  type OrderId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const orderId = asUuid<OrderId>("00000000-0000-4000-8000-000000000901");
const wallet = "wallet" as WalletAddress;
const signedAt = asTimestamp("2026-08-04T22:00:00Z");
const acknowledgedAt = asTimestamp("2026-08-04T22:00:01Z");
const execution: PreparedEntryExecution = Object.freeze({
  orderId,
  wallet,
  transactionFingerprint: "unsigned",
  serializedTransactionBase64: "AQ==",
  lastValidBlockHeight: 20n,
  prioritizationFeeLamports: 1n,
});
const signed = Object.freeze({
  serializedTransactionBase64: "Ag==",
  unsignedTransactionFingerprint: "unsigned",
  signedTransactionFingerprint: "signed",
  signature: "signature",
  wallet,
});

function dependencies() {
  let signing: PersistEntrySigning | undefined;
  let submission: PersistEntrySubmission | undefined;
  return {
    get signing() {
      return signing;
    },
    get submission() {
      return submission;
    },
    repository: {
      recordSigning: async (input: PersistEntrySigning) => {
        signing = input;
      },
      recordSubmission: async (input: PersistEntrySubmission) => {
        submission = input;
      },
    },
    inspector: {
      inspect: async () => ({
        serializedTransactionBase64: "AQ==",
        transactionFingerprint: "unsigned",
        wallet,
      }),
    },
    signer: { publicIdentity: async () => wallet, sign: async () => signed },
    authority: { now: () => signedAt, currentBlockHeight: async () => 10n },
    submissionPort: {
      submit: async () => ({ provider: "helius" as const, signature: "signature", acknowledgedAt }),
    },
  };
}

describe("durable entry submission", () => {
  it("durably binds signing before submission acknowledgement", async () => {
    const d = dependencies();
    const calls: string[] = [];
    const receipt = await submitPreparedEntry({
      execution,
      repository: {
        recordSigning: async (input) => {
          calls.push("signing");
          await d.repository.recordSigning(input);
        },
        recordSubmission: async (input) => {
          calls.push("submitted");
          await d.repository.recordSubmission(input);
        },
      },
      inspector: d.inspector,
      signer: d.signer,
      submission: {
        submit: async (transaction, deliveryId) => {
          calls.push("external");
          void transaction;
          void deliveryId;
          return d.submissionPort.submit();
        },
      },
      authority: d.authority,
    });
    expect(calls).toEqual(["signing", "external", "submitted"]);
    expect(d.signing?.deliveryId).toBe(`entry:${orderId}`);
    expect(d.submission?.receipt).toEqual(receipt);
  });

  it("fails closed before persistence when signer identity differs", async () => {
    const d = dependencies();
    await expect(
      submitPreparedEntry({
        execution,
        repository: d.repository,
        inspector: d.inspector,
        signer: { ...d.signer, publicIdentity: async () => "other" as WalletAddress },
        submission: d.submissionPort,
        authority: d.authority,
      }),
    ).rejects.toThrow("does not match");
    expect(d.signing).toBeUndefined();
  });

  it("does not record acknowledgement when external submission fails", async () => {
    const d = dependencies();
    await expect(
      submitPreparedEntry({
        execution,
        repository: d.repository,
        inspector: d.inspector,
        signer: d.signer,
        submission: {
          submit: async () => {
            throw new Error("unavailable");
          },
        },
        authority: d.authority,
      }),
    ).rejects.toThrow("unavailable");
    expect(d.signing?.signedTransaction.signature).toBe("signature");
    expect(d.submission).toBeUndefined();
  });

  it("rolls back acknowledgement when signing work is not available", async () => {
    const queries: string[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes("job_type='entry_signing'")) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [] };
      },
      release: () => undefined,
    } as never;
    const repository = new PostgresEntrySubmissionRepository({ connect: async () => client });
    await expect(
      repository.recordSubmission({
        orderId,
        deliveryId: `entry:${orderId}`,
        submittedAt: acknowledgedAt,
        receipt: { provider: "helius", signature: "signature", acknowledgedAt },
      }),
    ).rejects.toThrow("available signing work");
    expect(queries.at(-1)).toBe("ROLLBACK");
  });

  it("accepts an exact acknowledgement replay without scheduling duplicate work", async () => {
    const queries: string[] = [];
    const client = {
      query: async (text: string) => {
        queries.push(text);
        if (text.startsWith("UPDATE")) return { rowCount: 0, rows: [] };
        if (text.includes("FROM entry_submission_attempts AS attempt"))
          return { rowCount: 1, rows: [{ matches: true }] };
        return { rowCount: 1, rows: [] };
      },
      release: () => undefined,
    } as never;
    const repository = new PostgresEntrySubmissionRepository({ connect: async () => client });
    await repository.recordSubmission({
      orderId,
      deliveryId: `entry:${orderId}`,
      submittedAt: acknowledgedAt,
      receipt: { provider: "helius", signature: "signature", acknowledgedAt },
    });
    expect(queries.at(-1)).toBe("COMMIT");
    expect(queries.some((query) => query.includes("INSERT INTO jobs"))).toBe(false);
  });
});
