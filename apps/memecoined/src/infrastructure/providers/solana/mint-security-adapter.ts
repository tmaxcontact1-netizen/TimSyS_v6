import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";
import { z } from "zod";

import type { ObservationIdentityFactory } from "../../../application/contracts/observations.js";
import { ObservationUnavailableError } from "../../../application/contracts/observations.js";
import type { MintSecurityObservationPort } from "../../../application/ports/runtime-authority-inputs.js";
import type { TokenSecuritySnapshot } from "../../../domain/token/security.js";
import type { TokenExtension } from "../../../domain/token/security.js";
import { InvariantViolationError } from "../../../domain/shared/errors.js";
import {
  asPercentage,
  asTimestamp,
  type MintAddress,
  type ProviderId,
  type Timestamp,
} from "../../../domain/shared/types.js";
import { SolanaRpcClient, SolanaRpcError } from "./rpc-client.js";

const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const TOKEN_2022_TLV_OFFSET = 166;

function token2022Extensions(data: Buffer): readonly TokenExtension[] {
  if (data.length === 82) return Object.freeze([]);
  if (
    data.length < TOKEN_2022_TLV_OFFSET ||
    data.subarray(82, 165).some((value) => value !== 0) ||
    data[165] !== 1
  ) {
    return Object.freeze(["unapproved"]);
  }

  const extensions = new Set<TokenExtension>();
  let offset = TOKEN_2022_TLV_OFFSET;
  while (offset < data.length) {
    if (data.length - offset < 2) {
      if (data[offset] !== 0) extensions.add("unapproved");
      break;
    }
    const type = data.readUInt16LE(offset);
    if (type === 0) break;
    if (data.length - offset < 4) {
      extensions.add("unapproved");
      break;
    }
    const length = data.readUInt16LE(offset + 2);
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > data.length) {
      extensions.add("unapproved");
      break;
    }

    switch (type) {
      case 1:
        extensions.add("transfer_fee");
        break;
      case 6:
        if (length !== 1 || data[valueStart] === 2) extensions.add("default_account_frozen");
        break;
      case 12:
        extensions.add("permanent_delegate");
        break;
      case 14:
        extensions.add("transfer_hook");
        break;
      case 18: // MetadataPointer
      case 19: // TokenMetadata
        break;
      case 26:
        extensions.add("pausable_transfer");
        break;
      default:
        // Unsupported extensions are never silently assumed safe.
        extensions.add("unapproved");
    }
    offset = valueEnd;
  }
  return Object.freeze([...extensions]);
}
const accountSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.object({ data: z.tuple([z.string(), z.literal("base64")]), owner: z.string() }),
});
const largestSchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.array(z.object({ address: z.string(), amount: z.string().regex(/^\d+$/) })),
});
const supplySchema = z.object({
  context: z.object({ slot: z.number().int().safe().nonnegative() }),
  value: z.object({ amount: z.string().regex(/^\d+$/) }),
});

interface Read {
  readonly provider: ProviderId;
  readonly receivedAt: Timestamp;
  readonly raw: readonly unknown[];
  readonly snapshot: Omit<TokenSecuritySnapshot, "observedAt" | "evidence">;
}

async function read(
  client: SolanaRpcClient,
  provider: ProviderId,
  mint: MintAddress,
  excluded: ReadonlySet<string>,
): Promise<Read> {
  const [accountResponse, largestResponse, supplyResponse] = await Promise.all([
    client.request("getAccountInfo", [mint, { encoding: "base64", commitment: "confirmed" }]),
    client.request("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]),
    client.request("getTokenSupply", [mint, { commitment: "confirmed" }]),
  ]);
  const account = accountSchema.safeParse(accountResponse.result);
  const largest = largestSchema.safeParse(largestResponse.result);
  const supply = supplySchema.safeParse(supplyResponse.result);
  if (!account.success || !largest.success || !supply.success)
    throw new Error("Malformed mint-security response");
  const data = Buffer.from(account.data.value.data[0], "base64");
  if (data.length < 82 || data[45] !== 1)
    throw new Error("Mint account is malformed or uninitialized");
  const option = (offset: number) => data.readUInt32LE(offset);
  if (![0, 1].includes(option(0)) || ![0, 1].includes(option(46)))
    throw new Error("Mint authority option is malformed");
  const program =
    account.data.value.owner === SPL_TOKEN
      ? ("spl_token" as const)
      : account.data.value.owner === TOKEN_2022
        ? ("token_2022" as const)
        : ("unknown" as const);
  const extensions =
    program === "spl_token"
      ? Object.freeze([])
      : program === "token_2022"
        ? token2022Extensions(data)
        : Object.freeze(["unapproved" as const]);
  const normal = largest.data.value
    .filter(({ address }) => !excluded.has(address))
    .map(({ amount }) => BigInt(amount));
  const supplyRaw = BigInt(supply.data.value.amount);
  if (supplyRaw <= 0n) throw new Error("Mint supply must be positive");
  const percent = (amount: bigint) => {
    if (amount > supplyRaw) throw new SolanaRpcError("Holder balances exceed mint supply", false);
    return asPercentage(new Decimal(amount.toString()).mul(100).div(supplyRaw.toString()));
  };
  const topTenRaw = normal.slice(0, 10).reduce((sum, value) => sum + value, 0n);
  if (topTenRaw > supplyRaw)
    throw new SolanaRpcError("Largest holder balances exceed mint supply", false);
  return Object.freeze({
    provider,
    receivedAt: [accountResponse.receivedAt, largestResponse.receivedAt, supplyResponse.receivedAt]
      .sort()
      .at(-1)!,
    raw: Object.freeze([accountResponse.raw, largestResponse.raw, supplyResponse.raw]),
    snapshot: Object.freeze({
      directlyVerifiedOnChain: true,
      program,
      mintAuthority: option(0) === 0 ? "revoked" : "active",
      freezeAuthority: option(46) === 0 ? "revoked" : "active",
      extensions,
      extensionsVerified: program !== "unknown",
      holders: Object.freeze({
        topTenNormalPercentage: percent(topTenRaw),
        largestNormalPercentage: percent(normal[0] ?? 0n),
        exclusionsVerified: true,
      }),
    }),
  });
}

function comparable(value: Read): string {
  return JSON.stringify(value.snapshot, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}

export class SolanaMintSecurityAdapter implements MintSecurityObservationPort {
  public constructor(
    private readonly primary: SolanaRpcClient,
    private readonly fallback: SolanaRpcClient,
    private readonly identities: ObservationIdentityFactory,
  ) {}

  public async observe(
    mint: MintAddress,
    excluded: ReadonlySet<string>,
    requestedAt: Timestamp,
  ): Promise<TokenSecuritySnapshot> {
    const settled = await Promise.allSettled([
      read(this.primary, "helius", mint, excluded),
      read(this.fallback, "solana_rpc", mint, excluded),
    ]);
    const values = settled
      .filter((item): item is PromiseFulfilledResult<Read> => item.status === "fulfilled")
      .map(({ value }) => value);
    if (values.length !== 2) {
      const failures = settled.flatMap((item, index) =>
        item.status === "rejected"
          ? [
              `${index === 0 ? "Primary" : "Fallback"} RPC: ${item.reason instanceof Error ? item.reason.message : "request failed"}`,
            ]
          : [],
      );
      const retryable = settled.some(
        (item) =>
          item.status === "rejected" &&
          item.reason instanceof SolanaRpcError &&
          item.reason.retryable,
      );
      throw new ObservationUnavailableError(
        `Mint security requires two independent RPC reads. ${failures.join("; ")}`,
        retryable,
      );
    }
    if (comparable(values[0]!) !== comparable(values[1]!))
      throw new InvariantViolationError("Independent mint-security reads disagree");
    const evidence = values.map((value) => {
      const contentHash = createHash("sha256").update(JSON.stringify(value.raw)).digest("hex");
      const sourceKey = `${value.provider}:mint-security:${mint}`;
      return Object.freeze({
        id: this.identities.createEvidenceId({ provider: value.provider, sourceKey, contentHash }),
        provider: value.provider,
        observedAt: value.receivedAt,
        sourceKey,
        contentHash,
      });
    });
    const observedAt =
      values
        .map(({ receivedAt }) => receivedAt)
        .sort()
        .at(-1) ?? asTimestamp(requestedAt);
    return Object.freeze({ ...values[0]!.snapshot, observedAt, evidence: Object.freeze(evidence) });
  }
}
