import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";
import { BoundedJsonHttpTransport as PlatformJsonHttpTransport } from "@timsys/app-sdk";

export interface JsonTransportResponse {
  readonly status: number;
  readonly body: unknown;
  readonly receivedAt: Timestamp;
}

export interface JsonHttpTransportOptions {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly timeoutMs?: number;
  readonly maximumResponseBytes?: number;
  readonly fetch?: typeof fetch;
}

/** Bounded JSON-only HTTP transport with an exact outbound-origin allowlist. */
export class BoundedJsonHttpTransport {
  private readonly transport: PlatformJsonHttpTransport;

  public constructor(options: JsonHttpTransportOptions) {
    this.transport = new PlatformJsonHttpTransport(options);
  }

  public async request(
    method: "GET" | "POST",
    url: string,
    body: unknown | null,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<JsonTransportResponse> {
    const response = await this.transport.request(method, url, body, headers);
    return Object.freeze({ ...response, receivedAt: asTimestamp(new Date(response.receivedAt)) });
  }

  public get(url: string, headers: Readonly<Record<string, string>> = {}) {
    return this.request("GET", url, null, headers);
  }

  public post(url: string, body: unknown, headers: Readonly<Record<string, string>> = {}) {
    return this.request("POST", url, body, headers);
  }
}
