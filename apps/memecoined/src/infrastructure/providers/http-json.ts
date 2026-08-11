import { asTimestamp, type Timestamp } from "../../domain/shared/types.js";

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

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label} must be positive`);
  return value;
}

async function readLimitedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maximumBytes)
    throw new Error("HTTP response exceeds configured size limit");
  if (response.body === null) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > maximumBytes) throw new Error("HTTP response exceeds configured size limit");
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (length === 0) return null;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

/** Bounded JSON-only HTTP transport with an exact outbound-origin allowlist. */
export class BoundedJsonHttpTransport {
  private readonly timeoutMs: number;
  private readonly maximumResponseBytes: number;
  private readonly fetchImplementation: typeof fetch;

  public constructor(private readonly options: JsonHttpTransportOptions) {
    this.timeoutMs = positiveInteger(options.timeoutMs ?? 10_000, "HTTP timeout");
    this.maximumResponseBytes = positiveInteger(
      options.maximumResponseBytes ?? 2_000_000,
      "HTTP response limit",
    );
    this.fetchImplementation = options.fetch ?? fetch;
  }

  public async request(
    method: "GET" | "POST",
    url: string,
    body: unknown | null,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<JsonTransportResponse> {
    const target = new URL(url);
    if (target.protocol !== "https:" || !this.options.allowedOrigins.has(target.origin))
      throw new Error("Outbound HTTP target is not allowlisted");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(target, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...headers,
          ...(body === null ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === null ? {} : { body: JSON.stringify(body) }),
      });
      return Object.freeze({
        status: response.status,
        body: await readLimitedJson(response, this.maximumResponseBytes),
        receivedAt: asTimestamp(new Date()),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  public get(url: string, headers: Readonly<Record<string, string>> = {}) {
    return this.request("GET", url, null, headers);
  }

  public post(url: string, body: unknown, headers: Readonly<Record<string, string>> = {}) {
    return this.request("POST", url, body, headers);
  }
}
