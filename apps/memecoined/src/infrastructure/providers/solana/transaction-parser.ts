import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  ChainTransactionObservation,
  ObservationIdentityFactory,
  ObservationResult,
  ObservationTrace,
} from "../../../application/contracts/observations.js";
import type { ChainTransactionObservationPort } from "../../../application/ports/chain.js";
import {
  asRawAmount,
  asSolanaSlot,
  type MintAddress,
  type ProviderId,
  type Timestamp,
  type WalletAddress,
} from "../../../domain/shared/types.js";
import { SolanaRpcClient } from "./rpc-client.js";

const statusSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.tuple([
    z
      .object({
        slot: z.number().int().safe().nonnegative(),
        err: z.unknown().nullable(),
        confirmationStatus: z.enum(["processed", "confirmed", "finalized"]).nullable(),
      })
      .nullable(),
  ]),
});
const tokenBalanceSchema = z.object({
  accountIndex: z.number().int().safe().nonnegative(),
  mint: z.string(),
  owner: z.string().optional(),
  uiTokenAmount: z.object({ amount: z.string().regex(/^\d+$/) }),
});
const instructionSchema = z.object({
  program: z.string().optional(),
  parsed: z
    .object({
      type: z.string(),
      info: z.object({
        source: z.string().optional(),
        destination: z.string().optional(),
        lamports: z.number().int().safe().nonnegative().optional(),
      }),
    })
    .optional(),
});
const transactionSchema = z
  .object({
    slot: z.number().int().safe().nonnegative(),
    transaction: z.object({
      signatures: z.array(z.string().min(1)).min(1),
      message: z.object({
        accountKeys: z.array(
          z.union([z.string(), z.object({ pubkey: z.string(), signer: z.boolean().optional() })]),
        ),
        instructions: z.array(instructionSchema).optional().default([]),
      }),
    }),
    meta: z
      .object({
        err: z.unknown().nullable(),
        fee: z.number().int().safe().nonnegative(),
        preBalances: z.array(z.number().int().safe().nonnegative()),
        postBalances: z.array(z.number().int().safe().nonnegative()),
        preTokenBalances: z.array(tokenBalanceSchema).optional().default([]),
        postTokenBalances: z.array(tokenBalanceSchema).optional().default([]),
      })
      .nullable(),
  })
  .nullable();

interface ProviderTransactionRead {
  readonly provider: ProviderId;
  readonly receivedAt: Timestamp;
  readonly statusSlot: bigint;
  readonly observation: Omit<ChainTransactionObservation, "agreeingProviders" | "traces">;
  readonly raw: readonly unknown[];
}

function contentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function accountKey(value: string | { pubkey: string }): string {
  return typeof value === "string" ? value : value.pubkey;
}

function ownedTokenAmount(
  balances: readonly z.infer<typeof tokenBalanceSchema>[],
  wallet: WalletAddress,
  mint: MintAddress,
): bigint {
  return balances
    .filter((balance) => balance.owner === wallet && balance.mint === mint)
    .reduce((total, balance) => total + BigInt(balance.uiTokenAmount.amount), 0n);
}

async function readTransaction(
  provider: ProviderId,
  client: SolanaRpcClient,
  signature: string,
  wallet: WalletAddress,
  mint: MintAddress,
  tipRecipients: ReadonlySet<string>,
): Promise<ProviderTransactionRead> {
  const statusResponse = await client.request("getSignatureStatuses", [
    [signature],
    { searchTransactionHistory: true },
  ]);
  const status = statusSchema.safeParse(statusResponse.result);
  if (!status.success) throw new Error("Malformed transaction status");
  const item = status.data.value[0];
  if (
    item === null ||
    (item.confirmationStatus !== "confirmed" && item.confirmationStatus !== "finalized")
  )
    return Object.freeze({
      provider,
      receivedAt: statusResponse.receivedAt,
      statusSlot: BigInt(status.data.context.slot),
      observation: Object.freeze({
        signature,
        state: "pending" as const,
        slot: null,
        onChainError: null,
        wallet,
        mint,
        tokenBalanceBeforeRaw: null,
        tokenBalanceAfterRaw: null,
        nativeBalanceBeforeLamports: null,
        nativeBalanceAfterLamports: null,
        feeLamports: null,
        tipLamports: null,
      }),
      raw: Object.freeze([statusResponse.raw]),
    });

  const transactionResponse = await client.request("getTransaction", [
    signature,
    {
      commitment: "confirmed",
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 0,
    },
  ]);
  const parsed = transactionSchema.safeParse(transactionResponse.result);
  if (!parsed.success || parsed.data === null || parsed.data.meta === null)
    throw new Error("Confirmed transaction metadata is unavailable");
  if (parsed.data.transaction.signatures[0] !== signature)
    throw new Error("Transaction response signature mismatch");
  if (parsed.data.slot !== item.slot)
    throw new Error("Transaction response slot does not match its status");
  const walletIndex = parsed.data.transaction.message.accountKeys.findIndex(
    (key) => accountKey(key) === wallet,
  );
  if (
    walletIndex < 0 ||
    parsed.data.meta.preBalances[walletIndex] === undefined ||
    parsed.data.meta.postBalances[walletIndex] === undefined
  )
    throw new Error("Transaction does not contain the trading wallet balances");
  const failed = item.err !== null || parsed.data.meta.err !== null;
  const receivedAt =
    statusResponse.receivedAt > transactionResponse.receivedAt
      ? statusResponse.receivedAt
      : transactionResponse.receivedAt;
  const tipLamports = parsed.data.transaction.message.instructions.reduce((total, instruction) => {
    const info = instruction.parsed?.info;
    return instruction.program === "system" &&
      instruction.parsed?.type === "transfer" &&
      info?.source === wallet &&
      info.destination !== undefined &&
      tipRecipients.has(info.destination) &&
      info.lamports !== undefined
      ? total + BigInt(info.lamports)
      : total;
  }, 0n);
  return Object.freeze({
    provider,
    receivedAt,
    statusSlot: BigInt(item.slot),
    observation: Object.freeze({
      signature,
      state: failed ? ("failed" as const) : ("confirmed" as const),
      slot: asSolanaSlot(BigInt(parsed.data.slot)),
      onChainError: failed,
      wallet,
      mint,
      tokenBalanceBeforeRaw: asRawAmount(
        ownedTokenAmount(parsed.data.meta.preTokenBalances, wallet, mint),
      ),
      tokenBalanceAfterRaw: asRawAmount(
        ownedTokenAmount(parsed.data.meta.postTokenBalances, wallet, mint),
      ),
      nativeBalanceBeforeLamports: asRawAmount(BigInt(parsed.data.meta.preBalances[walletIndex]!)),
      nativeBalanceAfterLamports: asRawAmount(BigInt(parsed.data.meta.postBalances[walletIndex]!)),
      feeLamports: asRawAmount(BigInt(parsed.data.meta.fee)),
      tipLamports: asRawAmount(tipLamports),
    }),
    raw: Object.freeze([statusResponse.raw, transactionResponse.raw]),
  });
}

function sameObservation(left: ProviderTransactionRead, right: ProviderTransactionRead): boolean {
  const comparable = (value: ProviderTransactionRead) =>
    JSON.stringify(value.observation, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    );
  return comparable(left) === comparable(right);
}

/** Confirms a signature through two independent RPC routes before exposing wallet deltas. */
export class SolanaTransactionObservationAdapter implements ChainTransactionObservationPort {
  public constructor(
    private readonly primary: SolanaRpcClient,
    private readonly fallback: SolanaRpcClient,
    private readonly identities: ObservationIdentityFactory,
    private readonly tipRecipients: ReadonlySet<string> = new Set(),
  ) {}

  public async observeTransaction(
    signature: string,
    wallet: WalletAddress,
    mint: MintAddress,
    requestedAt: Timestamp,
  ): Promise<ObservationResult<ChainTransactionObservation>> {
    if (signature.trim().length === 0)
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "malformed" as const,
          provider: "solana_rpc" as const,
          occurredAt: requestedAt,
          retryable: false,
          reason: "Transaction signature is required",
        }),
      });
    const reads = await Promise.allSettled([
      readTransaction("helius", this.primary, signature, wallet, mint, this.tipRecipients),
      readTransaction("solana_rpc", this.fallback, signature, wallet, mint, this.tipRecipients),
    ]);
    const successful = reads
      .filter(
        (result): result is PromiseFulfilledResult<ProviderTransactionRead> =>
          result.status === "fulfilled",
      )
      .map(({ value }) => value);
    if (successful.length === 0)
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "unavailable" as const,
          provider: "solana_rpc" as const,
          occurredAt: requestedAt,
          retryable: true,
          reason: "Primary and fallback transaction reads are unavailable",
        }),
      });
    if (successful.length === 2 && !sameObservation(successful[0]!, successful[1]!))
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "contradictory" as const,
          provider: "solana_rpc" as const,
          occurredAt: successful[1]!.receivedAt,
          retryable: true,
          reason: "Primary and fallback transaction observations disagree",
        }),
      });
    const selected = successful[0]!;
    const traces: ObservationTrace[] = successful.map((item) => {
      const hash = contentHash(item.raw);
      const sourceKey = `${item.provider}:transaction:${signature}`;
      return Object.freeze({
        evidenceId: this.identities.createEvidenceId({
          provider: item.provider,
          sourceKey,
          contentHash: hash,
        }),
        provider: item.provider,
        method: "getSignatureStatuses+getTransaction",
        requestedAt,
        respondedAt: item.receivedAt,
        sourceTimestamp: null,
        normalizedAt: item.receivedAt,
        sourceKey,
        contentHash: hash,
        slot: asSolanaSlot(item.statusSlot),
      });
    });
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        ...selected.observation,
        agreeingProviders: Object.freeze(successful.map(({ provider }) => provider)),
        traces: Object.freeze(traces),
      }),
    });
  }
}
