import { expect, it, vi } from "vitest";
import { reconcileLiveEntry } from "../../src/application/services/live-entry-reconciliation.js";
import { asMintAddress } from "../../src/domain/token/token.js";

const at = "2026-08-27T12:00:00.000Z" as never;
const wallet = "entry-wallet" as never;
const mint = asMintAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const evidenceId = "00000000-0000-4000-8000-000000000981";
const trace = {
  evidenceId,
  provider: "solana_rpc", requestedAt: at, respondedAt: at, sourceKey: "chain", contentHash: "a".repeat(64),
} as never;
const work = {
  orderId: "00000000-0000-4000-8000-000000000982",
  tokenId: "00000000-0000-4000-8000-000000000983",
  wallet, mint, signature: "signature", minimumOutputAmount: 900n,
  walletConfirmation: "tier_a" as const,
  trackedWallets: [{ wallet: "tracked-wallet", tier: "tier_a" as const, independentGroupId: null }],
} as never;

it("reconciles confirmed wallet deltas into a supervised position baseline", async () => {
  const initialize = vi.fn(async (input) => ({ positionId: input.positionId }) as never);
  await expect(reconcileLiveEntry({
    work,
    transactions: { observeTransaction: async () => ({ ok: true, value: {
      signature: "signature", state: "confirmed", slot: 10n, onChainError: false,
      wallet, mint, tokenBalanceBeforeRaw: 0n, tokenBalanceAfterRaw: 1000n,
      nativeBalanceBeforeLamports: 10_000n, nativeBalanceAfterLamports: 8_900n,
      feeLamports: 100n, tipLamports: 0n, agreeingProviders: ["solana_rpc"], traces: [trace],
    } }) } as never,
    balances: { observeBalances: async () => ({ ok: true, value: {
      wallet: "tracked-wallet", mint, nativeBalanceLamports: 0n, tokenBalanceRaw: 500n,
      tokenDecimals: 6, agreeingProviders: ["solana_rpc"], traces: [trace],
    } }) } as never,
    security: { observe: async () => ({
      observedAt: at, evidence: [{ id: evidenceId, provider: "solana_rpc", observedAt: at, sourceKey: "security" }],
      directlyVerifiedOnChain: true, program: "spl_token", mintAuthority: "revoked",
      freezeAuthority: "revoked", extensions: [], extensionsVerified: true,
      holders: { topTenNormalPercentage: 10 as never, largestNormalPercentage: 2 as never, exclusionsVerified: true },
    }) } as never,
    positions: { initialize } as never,
    now: () => at,
  })).resolves.toBe(true);
  expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
    authorityBaseline: expect.objectContaining({
      wallet, tokenMint: mint,
      originatingTierA: expect.objectContaining({ wallet: "tracked-wallet", entryBalanceRaw: 500n }),
    }),
  }));
});

it("leaves pending submissions available for a later reconciliation cycle", async () => {
  const initialize = vi.fn();
  await expect(reconcileLiveEntry({
    work,
    transactions: { observeTransaction: async () => ({ ok: true, value: {
      signature: "signature", state: "pending", wallet, mint, traces: [trace],
    } }) } as never,
    balances: {} as never, security: {} as never, positions: { initialize } as never,
    now: () => at,
  })).resolves.toBe(false);
  expect(initialize).not.toHaveBeenCalled();
});
