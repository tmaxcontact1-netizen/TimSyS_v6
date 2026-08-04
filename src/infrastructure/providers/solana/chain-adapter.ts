import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  ChainBalanceObservation,
  ObservationIdentityFactory,
  ObservationResult,
  ObservationTrace,
} from "../../../application/contracts/observations.js";
import type { ChainObservationPort } from "../../../application/ports/chain.js";
import {
  asRawAmount,
  asSolanaSlot,
  type MintAddress,
  type ProviderId,
  type Timestamp,
  type WalletAddress,
} from "../../../domain/shared/types.js";
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

export class SolanaChainObservationAdapter implements ChainObservationPort {
  public constructor(
    private readonly primary: SolanaRpcClient,
    private readonly fallback: SolanaRpcClient,
    private readonly identities: ObservationIdentityFactory,
  ) {}

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
    if (
      successful.length === 2 &&
      (successful[0]!.native !== successful[1]!.native ||
        successful[0]!.token !== successful[1]!.token)
    )
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

    const selected = successful[0]!;
    const slot = successful.reduce(
      (minimum, item) => (item.slot < minimum ? item.slot : minimum),
      selected.slot,
    );
    const traces: ObservationTrace[] = successful.map((item) => {
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
    });
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
}
