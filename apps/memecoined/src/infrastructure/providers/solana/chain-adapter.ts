import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  ChainBalanceObservation,
  ObservationIdentityFactory,
  ObservationResult,
  ObservationTrace,
  WalletInventoryObservation,
} from "../../../application/contracts/observations.js";
import type {
  ChainProviderAgreementRecorder,
  ChainObservationPort,
  WalletInventoryObservationPort,
} from "../../../application/ports/chain.js";
import {
  asRawAmount,
  asSolanaSlot,
  type MintAddress,
  type ProviderId,
  type Timestamp,
  type WalletAddress,
} from "../../../domain/shared/types.js";
import type { EvidenceReference } from "../../../domain/shared/evidence.js";
import { SolanaRpcClient } from "./rpc-client.js";

const balanceSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.number().int().safe().nonnegative(),
});
const tokenAccountsSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.array(
    z.object({
      account: z.object({
        data: z.object({
          parsed: z.object({
            info: z.object({
              mint: z.string(),
              tokenAmount: z.object({ amount: z.string().regex(/^\d+$/) }),
            }),
          }),
        }),
      }),
    }),
  ),
});
const walletTokenAccountsSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.array(
    z.object({
      account: z.object({
        data: z.object({
          parsed: z.object({
            info: z.object({
              mint: z.string().min(1),
              tokenAmount: z.object({
                amount: z.string().regex(/^\d+$/),
                decimals: z.number().int().min(0).max(255),
              }),
            }),
          }),
        }),
      }),
    }),
  ),
});

interface ProviderRead {
  readonly provider: ProviderId;
  readonly native: bigint;
  readonly token: bigint;
  readonly slot: bigint;
  readonly receivedAt: Timestamp;
  readonly raw: readonly unknown[];
}

function hash(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

async function read(
  provider: ProviderId,
  client: SolanaRpcClient,
  wallet: WalletAddress,
  mint: MintAddress,
): Promise<ProviderRead> {
  const [nativeResponse, tokenResponse] = await Promise.all([
    client.request("getBalance", [wallet, { commitment: "confirmed" }]),
    client.request("getTokenAccountsByOwner", [
      wallet,
      { mint },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]),
  ]);
  const native = balanceSchema.safeParse(nativeResponse.result);
  const tokens = tokenAccountsSchema.safeParse(tokenResponse.result);
  if (!native.success || !tokens.success) throw new Error("Malformed balance observation");
  if (tokens.data.value.some((account) => account.account.data.parsed.info.mint !== mint))
    throw new Error("Token account response contains a different mint");
  const token = tokens.data.value.reduce(
    (total, account) => total + BigInt(account.account.data.parsed.info.tokenAmount.amount),
    0n,
  );
  return Object.freeze({
    provider,
    native: BigInt(native.data.value),
    token,
    slot: BigInt(Math.min(native.data.context.slot, tokens.data.context.slot)),
    receivedAt:
      nativeResponse.receivedAt > tokenResponse.receivedAt
        ? nativeResponse.receivedAt
        : tokenResponse.receivedAt,
    raw: Object.freeze([nativeResponse.raw, tokenResponse.raw]),
  });
}

export class SolanaChainObservationAdapter
  implements ChainObservationPort, WalletInventoryObservationPort
{
  public constructor(
    private readonly primary: SolanaRpcClient,
    private readonly fallback: SolanaRpcClient,
    private readonly identities: ObservationIdentityFactory,
    private readonly agreements?: ChainProviderAgreementRecorder,
  ) {}

  private traces(
    reads: readonly ProviderRead[],
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): readonly ObservationTrace[] {
    return Object.freeze(
      reads.map((item) => {
        const contentHash = hash(item.raw);
        const sourceKey = `${item.provider}:balances:${wallet}:${mint}`;
        return Object.freeze({
          evidenceId: this.identities.createEvidenceId({
            provider: item.provider,
            sourceKey,
            contentHash,
          }),
          provider: item.provider,
          method: "getBalance+getTokenAccountsByOwner",
          requestedAt,
          respondedAt: item.receivedAt,
          sourceTimestamp: null,
          normalizedAt: item.receivedAt,
          sourceKey,
          contentHash,
          slot: asSolanaSlot(item.slot),
        });
      }),
    );
  }

  private async recordAgreement(
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
    agrees: boolean,
    traces: readonly ObservationTrace[],
  ): Promise<void> {
    if (this.agreements === undefined || traces.length !== 2) return;
    const evidence: readonly EvidenceReference[] = traces.map((trace) =>
      Object.freeze({
        id: trace.evidenceId,
        provider: trace.provider,
        observedAt: trace.respondedAt,
        sourceKey: trace.sourceKey,
        contentHash: trace.contentHash,
        ...(trace.slot === undefined ? {} : { slot: trace.slot }),
      }),
    );
    const observedAt = traces.reduce(
      (latest, trace) => (trace.respondedAt > latest ? trace.respondedAt : latest),
      requestedAt,
    );
    await this.agreements.record({
      authorityKey: `chain-balances:${mint}`,
      wallet,
      observedAt,
      agrees,
      evidence,
    });
  }

  public async observeBalances(
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainBalanceObservation>> {
    const reads = await Promise.allSettled([
      read("helius", this.primary, wallet, mint),
      read("solana_rpc", this.fallback, wallet, mint),
    ]);
    const successful = reads
      .filter(
        (result): result is PromiseFulfilledResult<ProviderRead> => result.status === "fulfilled",
      )
      .map(({ value }) => value);
    if (successful.length === 0)
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "unavailable",
          provider: "solana_rpc",
          occurredAt: requestedAt,
          retryable: true,
          reason: "Primary and fallback chain access are unavailable",
        }),
      });
    const traces = this.traces(successful, wallet, mint, requestedAt);
    if (
      successful.length === 2 &&
      (successful[0]!.native !== successful[1]!.native ||
        successful[0]!.token !== successful[1]!.token)
    ) {
      await this.recordAgreement(wallet, mint, requestedAt, false, traces);
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "contradictory",
          provider: "solana_rpc",
          occurredAt: successful[1]!.receivedAt,
          retryable: true,
          reason: "Primary and fallback chain balances disagree",
        }),
      });
    }

    await this.recordAgreement(wallet, mint, requestedAt, true, traces);

    const selected = successful[0]!;
    const slot = successful.reduce(
      (minimum, item) => (item.slot < minimum ? item.slot : minimum),
      selected.slot,
    );
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        wallet,
        mint,
        nativeBalanceLamports: asRawAmount(selected.native),
        tokenBalanceRaw: asRawAmount(selected.token),
        slot: asSolanaSlot(slot),
        agreeingProviders: Object.freeze(successful.map(({ provider }) => provider)),
        traces: Object.freeze(traces),
      }),
    });
  }

  public async observeWalletInventory(
    wallet: WalletAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<WalletInventoryObservation>> {
    const readInventory = async (provider: ProviderId, client: SolanaRpcClient) => {
      const [nativeResponse, tokenResponse] = await Promise.all([
        client.request("getBalance", [wallet, { commitment: "confirmed" }]),
        client.request("getTokenAccountsByOwner", [
          wallet,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ]),
      ]);
      const native = balanceSchema.safeParse(nativeResponse.result);
      const tokens = walletTokenAccountsSchema.safeParse(tokenResponse.result);
      if (!native.success || !tokens.success) throw new Error("Malformed wallet inventory");
      const byMint = new Map<string, { amount: bigint; decimals: number }>();
      for (const account of tokens.data.value) {
        const { mint, tokenAmount } = account.account.data.parsed.info;
        const existing = byMint.get(mint);
        if (existing !== undefined && existing.decimals !== tokenAmount.decimals)
          throw new Error("Contradictory token decimals");
        byMint.set(mint, {
          amount: (existing?.amount ?? 0n) + BigInt(tokenAmount.amount),
          decimals: tokenAmount.decimals,
        });
      }
      const normalizedTokens = [...byMint.entries()]
        .filter(([, value]) => value.amount > 0n)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([mint, value]) => ({ mint, amount: value.amount, decimals: value.decimals }));
      return Object.freeze({
        provider,
        native: BigInt(native.data.value),
        tokens: normalizedTokens,
        slot: BigInt(Math.min(native.data.context.slot, tokens.data.context.slot)),
        receivedAt:
          nativeResponse.receivedAt > tokenResponse.receivedAt
            ? nativeResponse.receivedAt
            : tokenResponse.receivedAt,
        raw: Object.freeze([nativeResponse.raw, tokenResponse.raw]),
      });
    };
    const reads = await Promise.allSettled([
      readInventory("helius", this.primary),
      readInventory("solana_rpc", this.fallback),
    ]);
    const successful = reads
      .filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof readInventory>>> =>
          result.status === "fulfilled",
      )
      .map(({ value }) => value);
    if (successful.length === 0)
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "unavailable",
          provider: "solana_rpc",
          occurredAt: requestedAt,
          retryable: true,
          reason: "Primary and fallback wallet inventories are unavailable",
        }),
      });
    const canonical = (value: (typeof successful)[number]) =>
      JSON.stringify({
        native: value.native.toString(),
        tokens: value.tokens.map((token) => ({
          mint: token.mint,
          amount: token.amount.toString(),
          decimals: token.decimals,
        })),
      });
    if (successful.length === 2 && canonical(successful[0]!) !== canonical(successful[1]!))
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "contradictory",
          provider: "solana_rpc",
          occurredAt: successful[1]!.receivedAt,
          retryable: true,
          reason: "Primary and fallback wallet inventories disagree",
        }),
      });
    const selected = successful[0]!;
    const traces = successful.map((item) => {
      const contentHash = hash(item.raw);
      const sourceKey = `${item.provider}:wallet-inventory:${wallet}`;
      return Object.freeze({
        evidenceId: this.identities.createEvidenceId({
          provider: item.provider,
          sourceKey,
          contentHash,
        }),
        provider: item.provider,
        method: "getBalance+getTokenAccountsByOwner",
        requestedAt,
        respondedAt: item.receivedAt,
        sourceTimestamp: null,
        normalizedAt: item.receivedAt,
        sourceKey,
        contentHash,
        slot: asSolanaSlot(item.slot),
      });
    });
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        wallet,
        nativeBalanceLamports: asRawAmount(selected.native),
        tokens: Object.freeze(
          selected.tokens.map((token) =>
            Object.freeze({
              mint: token.mint as MintAddress,
              amountRaw: asRawAmount(token.amount),
              decimals: token.decimals,
            }),
          ),
        ),
        slot: asSolanaSlot(
          successful.reduce(
            (minimum, item) => (item.slot < minimum ? item.slot : minimum),
            selected.slot,
          ),
        ),
        agreeingProviders: Object.freeze(successful.map(({ provider }) => provider)),
        traces: Object.freeze(traces),
      }),
    });
  }
}
