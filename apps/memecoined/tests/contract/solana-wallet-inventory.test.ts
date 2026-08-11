import { expect, it } from "vitest";

import { SolanaChainObservationAdapter } from "../../src/infrastructure/providers/solana/chain-adapter.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-05T12:00:00Z");
const wallet = "wallet-1" as never;

function rpc(native: number, accounts: readonly unknown[]) {
  let call = 0;
  return {
    request: async () => {
      call += 1;
      return call % 2 === 1
        ? { result: { context: { slot: 20 }, value: native }, raw: { native }, receivedAt: at }
        : {
            result: { context: { slot: 21 }, value: accounts },
            raw: { accounts },
            receivedAt: at,
          };
    },
  } as never;
}

const account = (mint: string, amount: string, decimals = 6) => ({
  account: { data: { parsed: { info: { mint, tokenAmount: { amount, decimals } } } } },
});

const identities = {
  createEvidenceId: ({ provider }: { provider: string }) =>
    `${provider === "helius" ? "00000000-0000-4000-8000" : "00000000-0000-4001-8000"}-000000000001`,
} as never;

it("normalizes a complete agreed wallet inventory and aggregates token accounts", async () => {
  const accounts = [account("mint-b", "2"), account("mint-a", "3"), account("mint-a", "4")];
  const adapter = new SolanaChainObservationAdapter(
    rpc(1_000_000_000, accounts),
    rpc(1_000_000_000, accounts),
    identities,
  );
  const result = await adapter.observeWalletInventory(wallet, at);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.nativeBalanceLamports).toBe(1_000_000_000n);
  expect(result.value.tokens).toEqual([
    { mint: "mint-a", amountRaw: 7n, decimals: 6 },
    { mint: "mint-b", amountRaw: 2n, decimals: 6 },
  ]);
  expect(result.value.agreeingProviders).toEqual(["helius", "solana_rpc"]);
});

it("fails closed when providers disagree or both responses are malformed", async () => {
  const disagreement = new SolanaChainObservationAdapter(
    rpc(10, [account("mint-a", "3")]),
    rpc(10, [account("mint-a", "4")]),
    identities,
  );
  await expect(disagreement.observeWalletInventory(wallet, at)).resolves.toMatchObject({
    ok: false,
    error: { code: "contradictory" },
  });
  const malformed = { request: async () => ({ result: {}, raw: {}, receivedAt: at }) } as never;
  const unavailable = new SolanaChainObservationAdapter(malformed, malformed, identities);
  await expect(unavailable.observeWalletInventory(wallet, at)).resolves.toMatchObject({
    ok: false,
    error: { code: "unavailable" },
  });
});

it("rejects contradictory decimals within one provider inventory", async () => {
  const accounts = [account("mint-a", "3", 6), account("mint-a", "4", 9)];
  const malformed = new SolanaChainObservationAdapter(
    rpc(10, accounts),
    rpc(10, accounts),
    identities,
  );
  await expect(malformed.observeWalletInventory(wallet, at)).resolves.toMatchObject({
    ok: false,
    error: { code: "unavailable" },
  });
});
