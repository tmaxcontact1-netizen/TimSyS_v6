import { describe, expect, it } from "vitest";

import type { ObservationIdentityFactory } from "../../src/application/contracts/observations.js";
import { asTimestamp, asUuid, type EvidenceId } from "../../src/domain/shared/types.js";
import type { WalletAddress } from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import { SolanaChainObservationAdapter } from "../../src/infrastructure/providers/solana/chain-adapter.js";
import {
  SolanaRpcClient,
  type SolanaRpcTransport,
} from "../../src/infrastructure/providers/solana/rpc-client.js";

const mint = asMintAddress("So11111111111111111111111111111111111111112");
const wallet = "11111111111111111111111111111111" as WalletAddress;
const receivedAt = asTimestamp("2026-08-04T12:00:01Z");
let identity = 600;
const identities: ObservationIdentityFactory = {
  createEvidenceId: () =>
    asUuid<EvidenceId>(`00000000-0000-4000-8000-${(++identity).toString().padStart(12, "0")}`),
};

function transport(
  native: number,
  token: string,
  slot = 900,
  returnedMint: string = mint,
): SolanaRpcTransport {
  return {
    post: async (request) => {
      const value = request as { id: number; method: string };
      const result =
        value.method === "getBalance"
          ? { context: { slot }, value: native }
          : {
              context: { slot: slot + 1 },
              value: [
                {
                  account: {
                    data: {
                      parsed: { info: { mint: returnedMint, tokenAmount: { amount: token } } },
                    },
                  },
                },
              ],
            };
      return {
        status: 200,
        body: { jsonrpc: "2.0", id: value.id, result },
        receivedAt,
      };
    },
  };
}

function adapter(primary = transport(2_000, "9000"), fallback = transport(2_000, "9000")) {
  return new SolanaChainObservationAdapter(
    new SolanaRpcClient(primary),
    new SolanaRpcClient(fallback),
    identities,
  );
}

describe("Solana chain observation contract", () => {
  it("normalizes agreeing primary and fallback confirmed balances", async () => {
    const result = await adapter().observeBalances(
      wallet,
      mint,
      asTimestamp("2026-08-04T12:00:00Z"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      wallet,
      mint,
      nativeBalanceLamports: 2_000n,
      tokenBalanceRaw: 9_000n,
      slot: 900n,
      agreeingProviders: ["helius", "solana_rpc"],
    });
    expect(result.value.traces).toHaveLength(2);
    expect(result.value.traces.every(({ contentHash }) => /^[0-9a-f]{64}$/.test(contentHash))).toBe(
      true,
    );
    expect(Object.isFrozen(result.value.traces)).toBe(true);
  });

  it("rejects provider disagreement instead of selecting a convenient balance", async () => {
    const result = await adapter(
      transport(2_000, "9000"),
      transport(2_000, "8999"),
    ).observeBalances(wallet, mint, receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("contradictory");
  });

  it("uses the surviving provider when one read route is unavailable", async () => {
    const unavailable: SolanaRpcTransport = { post: async () => Promise.reject(new Error("down")) };
    const result = await adapter(unavailable, transport(2_000, "9000")).observeBalances(
      wallet,
      mint,
      receivedAt,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.agreeingProviders).toEqual(["solana_rpc"]);
  });

  it("reports total chain unavailability only when both reads fail", async () => {
    const unavailable: SolanaRpcTransport = { post: async () => Promise.reject(new Error("down")) };
    const result = await adapter(unavailable, unavailable).observeBalances(
      wallet,
      mint,
      receivedAt,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ code: "unavailable", retryable: true });
  });

  it("rejects malformed RPC envelopes and balance payloads", async () => {
    const malformed: SolanaRpcTransport = {
      post: async () => ({ status: 200, body: { nope: true }, receivedAt }),
    };
    const result = await adapter(malformed, malformed).observeBalances(wallet, mint, receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unavailable");
  });

  it("rejects a token-account response for a different mint", async () => {
    const wrongMint = transport(2_000, "9000", 900, "different-mint");
    const result = await adapter(wrongMint, wrongMint).observeBalances(wallet, mint, receivedAt);
    expect(result.ok).toBe(false);
  });
});
