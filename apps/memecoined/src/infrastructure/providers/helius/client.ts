import type { Timestamp } from "../../../domain/shared/types.js";
import type { BoundedJsonHttpTransport } from "../http-json.js";

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

export class HeliusSenderHttpTransport implements HeliusSenderTransport {
  private requestId = 0;

  public constructor(
    private readonly http: BoundedJsonHttpTransport,
    apiKey: string,
    baseUrl = "https://sender.helius-rpc.com/fast",
  ) {
    const endpoint = new URL(baseUrl);
    endpoint.searchParams.set("api-key", apiKey);
    this.endpoint = endpoint.toString();
  }

  private readonly endpoint: string;

  public async send(serializedSignedTransactionBase64: string): Promise<HeliusSenderResponse> {
    const response = await this.http.post(this.endpoint, {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method: "sendTransaction",
      params: [
        serializedSignedTransactionBase64,
        { encoding: "base64", skipPreflight: true, maxRetries: 0 },
      ],
    });
    if (response.status === 429)
      throw new HeliusSubmissionError("rate_limited", true, "Helius Sender rate limit");
    if (response.status >= 500)
      throw new HeliusSubmissionError("unavailable", true, "Helius Sender unavailable");
    if (response.status < 200 || response.status >= 300)
      throw new HeliusSubmissionError("rejected", false, "Helius Sender rejected request");
    return Object.freeze({ body: response.body, receivedAt: response.receivedAt });
  }
}
