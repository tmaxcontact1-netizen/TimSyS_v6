import { z } from "zod";

import type {
  SignedTransaction,
  SubmissionReceipt,
  TransactionSubmissionPort,
} from "../../../application/ports/signer.js";
import { InvariantViolationError } from "../../../domain/shared/errors.js";
import { HeliusSubmissionError, type HeliusSenderTransport } from "./client.js";

const responseSchema = z.union([
  z.object({ signature: z.string().min(1) }),
  z.object({ result: z.string().min(1) }),
]);

/** Sender acknowledgement is submission evidence only; confirmation remains a chain/reconciliation concern. */
export class HeliusSubmissionAdapter implements TransactionSubmissionPort {
  private readonly deliveries = new Map<
    string,
    { fingerprint: string; receipt: SubmissionReceipt }
  >();

  public constructor(private readonly transport: HeliusSenderTransport) {}

  public async submit(
    transaction: SignedTransaction,
    deliveryId: string,
  ): Promise<SubmissionReceipt> {
    if (deliveryId.trim().length === 0)
      throw new InvariantViolationError("Delivery ID is required");
    const existing = this.deliveries.get(deliveryId);
    if (existing !== undefined) {
      if (existing.fingerprint !== transaction.signedTransactionFingerprint)
        throw new InvariantViolationError("Delivery ID was reused for a different transaction");
      return existing.receipt;
    }
    let response;
    try {
      response = await this.transport.send(transaction.serializedTransactionBase64);
    } catch (error) {
      if (error instanceof HeliusSubmissionError) throw error;
      throw new HeliusSubmissionError("unavailable", true, "Helius Sender is unavailable");
    }
    const parsed = responseSchema.safeParse(response.body);
    if (!parsed.success)
      throw new HeliusSubmissionError(
        "malformed",
        false,
        "Malformed Helius Sender acknowledgement",
      );
    const signature = "signature" in parsed.data ? parsed.data.signature : parsed.data.result;
    if (signature !== transaction.signature)
      throw new HeliusSubmissionError(
        "rejected",
        false,
        "Sender acknowledgement signature mismatch",
      );
    const receipt = Object.freeze({
      provider: "helius" as const,
      signature,
      acknowledgedAt: response.receivedAt,
    });
    this.deliveries.set(deliveryId, {
      fingerprint: transaction.signedTransactionFingerprint,
      receipt,
    });
    return receipt;
  }
}
