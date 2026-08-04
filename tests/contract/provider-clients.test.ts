import { describe, expect, it, vi } from "vitest";

import { asTimestamp } from "../../src/domain/shared/types.js";
import { composeProductionProviders } from "../../src/entrypoints/providers.js";
import { HeliusSenderHttpTransport } from "../../src/infrastructure/providers/helius/client.js";
import {
  SolanaExecutionRpc,
  SolanaRpcClient,
} from "../../src/infrastructure/providers/solana/rpc-client.js";
import { DeterministicEvidenceIdentityFactory } from "../../src/infrastructure/runtime/evidence-id.js";

const now = asTimestamp("2026-08-04T00:00:00.000Z");

describe("production provider clients", () => {
  it("constructs the exact Helius Sender RPC request", async () => {
    const post = vi.fn(async () => ({
      status: 200,
      body: { result: "signature" },
      receivedAt: now,
    }));
    const sender = new HeliusSenderHttpTransport({ post } as never, "secret");
    await sender.send("signed-base64");
    expect(post).toHaveBeenCalledWith(
      "https://sender.helius-rpc.com/fast?api-key=secret",
      expect.objectContaining({
        method: "sendTransaction",
        params: ["signed-base64", { encoding: "base64", skipPreflight: true, maxRetries: 0 }],
      }),
    );
  });

  it("classifies Sender throttling before exposing an acknowledgement", async () => {
    const sender = new HeliusSenderHttpTransport(
      { post: async () => ({ status: 429, body: {}, receivedAt: now }) } as never,
      "secret",
    );
    await expect(sender.send("signed-base64")).rejects.toMatchObject({
      code: "rate_limited",
      retryable: true,
    });
  });

  it("uses confirmed RPC context for block height and simulation", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        body: { jsonrpc: "2.0", id: 1, result: 123 },
        receivedAt: now,
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { jsonrpc: "2.0", id: 2, result: { context: { slot: 1 }, value: { err: null } } },
        receivedAt: now,
      });
    const execution = new SolanaExecutionRpc(new SolanaRpcClient({ post }));
    await expect(execution.currentBlockHeight()).resolves.toBe(123n);
    await execution.simulateTransaction("transaction");
    expect(post.mock.calls[1]?.[0]).toMatchObject({
      method: "simulateTransaction",
      params: [
        "transaction",
        expect.objectContaining({ commitment: "confirmed", replaceRecentBlockhash: false }),
      ],
    });
  });

  it("derives stable UUID evidence identities", () => {
    const identities = new DeterministicEvidenceIdentityFactory();
    const input = { provider: "jupiter" as const, sourceKey: "quote:1", contentHash: "abc" };
    expect(identities.createEvidenceId(input)).toBe(identities.createEvidenceId(input));
    expect(identities.createEvidenceId(input)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refuses provider composition outside an execution mode", () =>
    expect(() => composeProductionProviders({ solana: null, execution: null } as never)).toThrow(
      /execution-enabled/,
    ));
});
