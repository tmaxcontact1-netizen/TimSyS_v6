import { describe, expect, it, vi } from "vitest";

import type { ObservationIdentityFactory } from "../../src/application/contracts/observations.js";
import { asTimestamp, asUuid, type EvidenceId } from "../../src/domain/shared/types.js";
import type { WalletAddress } from "../../src/domain/shared/types.js";
import { asMintAddress } from "../../src/domain/token/token.js";
import { SolanaChainObservationAdapter } from "../../src/infrastructure/providers/solana/chain-adapter.js";
import {
  SolanaRpcClient,
  type SolanaRpcTransport,
} from "../../src/infrastructure/providers/solana/rpc-client.js";
import { SolanaTransactionObservationAdapter } from "../../src/infrastructure/providers/solana/transaction-parser.js";

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

function adapter(
  primary = transport(2_000, "9000"),
  fallback = transport(2_000, "9000"),
  recorder?: { record: (input: unknown) => Promise<void> },
) {
  return new SolanaChainObservationAdapter(
    new SolanaRpcClient(primary),
    new SolanaRpcClient(fallback),
    identities,
    recorder,
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
    const record = vi.fn(async () => undefined);
    const result = await adapter(transport(2_000, "9000"), transport(2_000, "8999"), {
      record,
    }).observeBalances(wallet, mint, receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("contradictory");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityKey: `chain-balances:${mint}`,
        wallet,
        agrees: false,
        evidence: expect.arrayContaining([
          expect.objectContaining({ provider: "helius" }),
          expect.objectContaining({ provider: "solana_rpc" }),
        ]),
      }),
    );
  });

  it("closes disagreement only after two providers explicitly agree", async () => {
    const record = vi.fn(async () => undefined);
    await adapter(transport(2_000, "9000"), transport(2_000, "9000"), {
      record,
    }).observeBalances(wallet, mint, receivedAt);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ agrees: true }));

    record.mockClear();
    const unavailable: SolanaRpcTransport = { post: async () => Promise.reject(new Error("down")) };
    await adapter(unavailable, transport(2_000, "9000"), { record }).observeBalances(
      wallet,
      mint,
      receivedAt,
    );
    expect(record).not.toHaveBeenCalled();
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

const signature = "signature-600";

function transactionTransport(
  options: {
    pending?: boolean;
    postToken?: string;
    signature?: string;
    error?: unknown;
    tip?: { destination: string; lamports: number };
  } = {},
): SolanaRpcTransport {
  return {
    post: async (request) => {
      const value = request as { id: number; method: string };
      const result =
        value.method === "getSignatureStatuses"
          ? {
              context: { slot: 999 },
              value: options.pending
                ? [null]
                : [{ slot: 998, err: options.error ?? null, confirmationStatus: "confirmed" }],
            }
          : {
              slot: 998,
              transaction: {
                signatures: [options.signature ?? signature],
                message: {
                  accountKeys: [{ pubkey: wallet, signer: true }, "other"],
                  instructions:
                    options.tip === undefined
                      ? []
                      : [
                          {
                            program: "system",
                            parsed: {
                              type: "transfer",
                              info: { source: wallet, ...options.tip },
                            },
                          },
                        ],
                },
              },
              meta: {
                err: options.error ?? null,
                fee: 5_000,
                preBalances: [1_000_000_000, 0],
                postBalances: [1_500_000_000, 0],
                preTokenBalances: [
                  { accountIndex: 1, mint, owner: wallet, uiTokenAmount: { amount: "9000" } },
                ],
                postTokenBalances: [
                  {
                    accountIndex: 1,
                    mint,
                    owner: wallet,
                    uiTokenAmount: { amount: options.postToken ?? "0" },
                  },
                ],
              },
            };
      return {
        status: 200,
        body: { jsonrpc: "2.0", id: value.id, result },
        receivedAt,
      };
    },
  };
}

function transactionAdapter(
  primary: SolanaRpcTransport = transactionTransport(),
  fallback: SolanaRpcTransport = transactionTransport(),
) {
  return new SolanaTransactionObservationAdapter(
    new SolanaRpcClient(primary),
    new SolanaRpcClient(fallback),
    identities,
  );
}

describe("Solana transaction observation contract", () => {
  it("requires two agreeing confirmed transaction reconstructions", async () => {
    const result = await transactionAdapter().observeTransaction(
      signature,
      wallet,
      mint,
      receivedAt,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      signature,
      state: "confirmed",
      onChainError: false,
      tokenBalanceBeforeRaw: 9_000n,
      tokenBalanceAfterRaw: 0n,
      nativeBalanceBeforeLamports: 1_000_000_000n,
      nativeBalanceAfterLamports: 1_500_000_000n,
      feeLamports: 5_000n,
      tipLamports: 0n,
      agreeingProviders: ["helius", "solana_rpc"],
    });
  });

  it("keeps an absent signature pending without fabricating transaction data", async () => {
    const result = await transactionAdapter(
      transactionTransport({ pending: true }),
      transactionTransport({ pending: true }),
    ).observeTransaction(signature, wallet, mint, receivedAt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ state: "pending", slot: null, feeLamports: null });
  });

  it("rejects contradictory post-token balances", async () => {
    const result = await transactionAdapter(
      transactionTransport(),
      transactionTransport({ postToken: "1" }),
    ).observeTransaction(signature, wallet, mint, receivedAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("contradictory");
  });

  it("rejects confirmed transaction data bound to another signature", async () => {
    const wrong = transactionTransport({ signature: "different" });
    const result = await transactionAdapter(wrong, wrong).observeTransaction(
      signature,
      wallet,
      mint,
      receivedAt,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unavailable");
  });

  it("reconstructs an allowlisted Sender tip instead of assuming zero", async () => {
    const tipRecipient = "Tip1111111111111111111111111111111111111";
    const transport = transactionTransport({
      tip: { destination: tipRecipient, lamports: 1_000_000 },
    });
    const adapter = new SolanaTransactionObservationAdapter(
      new SolanaRpcClient(transport),
      new SolanaRpcClient(transport),
      identities,
      new Set([tipRecipient]),
    );
    const result = await adapter.observeTransaction(signature, wallet, mint, receivedAt);
    expect(result.ok && result.value.tipLamports).toBe(1_000_000n);
  });
});
