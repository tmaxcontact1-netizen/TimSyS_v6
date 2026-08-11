import { z } from "zod";

import type { Timestamp } from "../../../domain/shared/types.js";
import { asTimestamp } from "../../../domain/shared/types.js";
import type { TransactionSimulationClient } from "../jupiter/adapter.js";
import type { BoundedJsonHttpTransport } from "../http-json.js";

export interface SolanaRpcTransportResponse {
  readonly status: number;
  readonly body: unknown;
  readonly receivedAt: Timestamp;
}

export interface SolanaRpcTransport {
  post(body: unknown): Promise<SolanaRpcTransportResponse>;
}

export class SolanaRpcHttpTransport implements SolanaRpcTransport {
  public constructor(
    private readonly http: BoundedJsonHttpTransport,
    private readonly endpoint: string,
  ) {}

  public post(body: unknown): Promise<SolanaRpcTransportResponse> {
    return this.http.post(this.endpoint, body);
  }
}

const envelope = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number().int(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number().int(), message: z.string() }).optional(),
});

export class SolanaRpcError extends Error {
  public constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SolanaRpcError";
  }
}

export interface SolanaRpcResult {
  readonly result: unknown;
  readonly receivedAt: Timestamp;
  readonly raw: unknown;
}

export class SolanaRpcClient {
  private requestId = 0;

  public constructor(private readonly transport: SolanaRpcTransport) {}

  public async request(method: string, params: readonly unknown[]): Promise<SolanaRpcResult> {
    const id = ++this.requestId;
    let response: SolanaRpcTransportResponse;
    try {
      response = await this.transport.post({ jsonrpc: "2.0", id, method, params });
    } catch {
      throw new SolanaRpcError("Solana RPC transport failed", true);
    }
    if (response.status === 429 || response.status >= 500)
      throw new SolanaRpcError("Solana RPC is temporarily unavailable", true);
    if (response.status < 200 || response.status >= 300)
      throw new SolanaRpcError("Solana RPC rejected the request", false);
    const parsed = envelope.safeParse(response.body);
    if (!parsed.success || parsed.data.id !== id)
      throw new SolanaRpcError("Malformed Solana RPC response", false);
    if (parsed.data.error !== undefined)
      throw new SolanaRpcError(`Solana RPC error ${parsed.data.error.code}`, false);
    if (!("result" in parsed.data))
      throw new SolanaRpcError("Solana RPC response omitted result", false);
    return Object.freeze({
      result: parsed.data.result,
      receivedAt: response.receivedAt,
      raw: response.body,
    });
  }
}

/** Exposes only the execution-related RPC methods required by the application boundary. */
export class SolanaExecutionRpc implements TransactionSimulationClient {
  public constructor(private readonly client: SolanaRpcClient) {}

  public async currentBlockHeight(): Promise<bigint> {
    const response = await this.client.request("getBlockHeight", [{ commitment: "confirmed" }]);
    if (!Number.isSafeInteger(response.result) || (response.result as number) < 0)
      throw new SolanaRpcError("Malformed block height", false);
    return BigInt(response.result as number);
  }

  public now(): Timestamp {
    return asTimestamp(new Date());
  }

  public async simulateTransaction(serializedTransactionBase64: string) {
    return this.client.request("simulateTransaction", [
      serializedTransactionBase64,
      {
        encoding: "base64",
        commitment: "confirmed",
        replaceRecentBlockhash: false,
        sigVerify: false,
      },
    ]);
  }
}
