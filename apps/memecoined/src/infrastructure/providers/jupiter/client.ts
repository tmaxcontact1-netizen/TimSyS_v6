import type { Timestamp } from "../../../domain/shared/types.js";

export interface JupiterHttpResponse {
  readonly status: number;
  readonly body: unknown;
  readonly receivedAt: Timestamp;
}

export interface JupiterHttpTransport {
  get(url: string, headers: Readonly<Record<string, string>>): Promise<JupiterHttpResponse>;
  post(
    url: string,
    body: unknown,
    headers: Readonly<Record<string, string>>,
  ): Promise<JupiterHttpResponse>;
}

export type JupiterClientFailureCode = "validation" | "rate_limited" | "unavailable";

export class JupiterClientError extends Error {
  public constructor(
    message: string,
    public readonly code: JupiterClientFailureCode,
    public readonly retryable: boolean,
    public readonly occurredAt: Timestamp,
  ) {
    super(message);
    this.name = "JupiterClientError";
  }
}

export interface JupiterClientResponse {
  readonly body: unknown;
  readonly receivedAt: Timestamp;
}

export class JupiterSwapApiClient {
  private readonly headers: Readonly<Record<string, string>>;

  public constructor(
    private readonly transport: JupiterHttpTransport,
    apiKey: string | null,
    private readonly baseUrl = "https://api.jup.ag/swap/v1",
  ) {
    this.headers = Object.freeze({
      Accept: "application/json",
      ...(apiKey === null ? {} : { "x-api-key": apiKey }),
    });
  }

  private classify(response: JupiterHttpResponse): JupiterClientResponse {
    if (response.status >= 200 && response.status < 300)
      return Object.freeze({ body: response.body, receivedAt: response.receivedAt });
    if (response.status === 429)
      throw new JupiterClientError("Jupiter rate limit", "rate_limited", true, response.receivedAt);
    if (response.status >= 500)
      throw new JupiterClientError(
        "Jupiter is temporarily unavailable",
        "unavailable",
        true,
        response.receivedAt,
      );
    throw new JupiterClientError(
      "Jupiter rejected the request",
      "validation",
      false,
      response.receivedAt,
    );
  }

  public async quote(query: string, requestedAt: Timestamp): Promise<JupiterClientResponse> {
    try {
      return this.classify(
        await this.transport.get(`${this.baseUrl}/quote?${query}`, this.headers),
      );
    } catch (error) {
      if (error instanceof JupiterClientError) throw error;
      throw new JupiterClientError(
        "Jupiter quote transport failed",
        "unavailable",
        true,
        requestedAt,
      );
    }
  }

  public async construct(body: unknown, requestedAt: Timestamp): Promise<JupiterClientResponse> {
    try {
      return this.classify(
        await this.transport.post(`${this.baseUrl}/swap`, body, {
          ...this.headers,
          "Content-Type": "application/json",
        }),
      );
    } catch (error) {
      if (error instanceof JupiterClientError) throw error;
      throw new JupiterClientError(
        "Jupiter swap transport failed",
        "unavailable",
        true,
        requestedAt,
      );
    }
  }
}
