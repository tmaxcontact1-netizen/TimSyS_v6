import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";
import { z } from "zod";

import type { ObservationIdentityFactory } from "../../../application/contracts/observations.js";
import type { MintSecurityObservationPort } from "../../../application/ports/runtime-authority-inputs.js";
import type { TokenSecuritySnapshot } from "../../../domain/token/security.js";
import { InvariantViolationError } from "../../../domain/shared/errors.js";
import {
  asPercentage,
  asTimestamp,
  type MintAddress,
  type ProviderId,
  type Timestamp,
} from "../../../domain/shared/types.js";
import { SolanaRpcClient } from "./rpc-client.js";

const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdYqgP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
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
  const normal = largest.data.value
    .filter(({ address }) => !excluded.has(address))
    .map(({ amount }) => BigInt(amount));
  const supplyRaw = BigInt(supply.data.value.amount);
  if (supplyRaw <= 0n) throw new Error("Mint supply must be positive");
  const percent = (amount: bigint) =>
    asPercentage(new Decimal(amount.toString()).mul(100).div(supplyRaw.toString()));
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
      extensions: Object.freeze(program === "spl_token" ? [] : ["unapproved" as const]),
      extensionsVerified: program !== "unknown",
      holders: Object.freeze({
        topTenNormalPercentage: percent(
          normal.slice(0, 10).reduce((sum, value) => sum + value, 0n),
        ),
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
    if (values.length !== 2)
      throw new InvariantViolationError("Mint security requires two independent RPC reads");
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
