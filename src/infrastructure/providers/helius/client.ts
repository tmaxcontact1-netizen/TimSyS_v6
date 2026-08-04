import type { Timestamp } from "../../../domain/shared/types.js";

export type HeliusSubmissionErrorCode = "rate_limited" | "unavailable" | "rejected" | "malformed";

export class HeliusSubmissionError extends Error {
  public constructor(
    public readonly code: HeliusSubmissionErrorCode,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "HeliusSubmissionError";
  }
}

export interface HeliusSenderResponse {
  readonly body: unknown;
  readonly receivedAt: Timestamp;
}

export interface HeliusSenderTransport {
  send(serializedSignedTransactionBase64: string): Promise<HeliusSenderResponse>;
}
