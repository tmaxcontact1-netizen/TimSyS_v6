import { createHash } from "node:crypto";

import { z } from "zod";

import type { ObservationIdentityFactory } from "../../../application/contracts/observations.js";
import type {
  TrackedWalletPurchaseObservation,
  TrackedWalletPurchasePort,
} from "../../../application/ports/stream.js";
import { asRawAmount, asSolanaSlot, asTimestamp } from "../../../domain/shared/types.js";
import { asMintAddress } from "../../../domain/token/token.js";
import type { BoundedJsonHttpTransport } from "../http-json.js";

const responseSchema = z.array(
  z.object({
    signature: z.string().min(1),
    slot: z.number().int().safe().nonnegative(),
    timestamp: z.number().int().safe().nonnegative(),
    transactionError: z.unknown().nullable().optional(),
    tokenTransfers: z.array(
      z.object({
        mint: z.string(),
        toUserAccount: z.string().nullable().optional(),
        rawTokenAmount: z.object({ tokenAmount: z.string().regex(/^\d+$/) }),
      }),
    ),
    nativeTransfers: z.array(
      z.object({
        fromUserAccount: z.string().nullable().optional(),
        amount: z.number().int().safe().nonnegative(),
      }),
    ),
  }),
);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Polls Helius enhanced transactions and exposes only successful token acquisitions. */
export class HeliusTrackedWalletPurchaseAdapter implements TrackedWalletPurchasePort {
  public constructor(
    private readonly http: BoundedJsonHttpTransport,
    private readonly apiKey: string,
    private readonly identities: ObservationIdentityFactory,
  ) {
    if (apiKey.trim().length === 0) throw new TypeError("Helius API key is required");
  }

  public async observePurchases(
    input: Parameters<TrackedWalletPurchasePort["observePurchases"]>[0],
  ): Promise<readonly TrackedWalletPurchaseObservation[]> {
    const endpoint = new URL(
      `https://api.helius.xyz/v0/addresses/${encodeURIComponent(input.wallet)}/transactions`,
    );
    endpoint.searchParams.set("api-key", this.apiKey);
    if (input.afterSignature !== null) endpoint.searchParams.set("until", input.afterSignature);
    const response = await this.http.get(endpoint.toString());
    if (response.status === 429 || response.status >= 500)
      throw new Error("Helius wallet observation is temporarily unavailable");
    if (response.status < 200 || response.status >= 300)
      throw new Error("Helius wallet observation was rejected");
    const parsed = responseSchema.safeParse(response.body);
    if (!parsed.success) throw new Error("Malformed Helius wallet transaction response");
    const purchases: TrackedWalletPurchaseObservation[] = [];
    for (const transaction of parsed.data) {
      if (transaction.transactionError != null) continue;
      const spent = transaction.nativeTransfers
        .filter(({ fromUserAccount }) => fromUserAccount === input.wallet)
        .reduce((sum, transfer) => sum + BigInt(transfer.amount), 0n);
      for (const transfer of transaction.tokenTransfers) {
        if (
          transfer.toUserAccount !== input.wallet ||
          BigInt(transfer.rawTokenAmount.tokenAmount) <= 0n
        )
          continue;
        const mint = asMintAddress(transfer.mint);
        const sourceKey = `${transaction.signature}:${mint}`;
        const contentHash = hash({ transaction, mint });
        purchases.push(
          Object.freeze({
            walletId: input.walletId,
            wallet: input.wallet,
            signature: transaction.signature,
            mint,
            purchasedAt: asTimestamp(new Date(transaction.timestamp * 1_000)),
            observedAt: response.receivedAt,
            slot: asSolanaSlot(BigInt(transaction.slot)),
            acquiredAmountRaw: asRawAmount(BigInt(transfer.rawTokenAmount.tokenAmount)),
            nativeSpentLamports: asRawAmount(spent),
            trace: Object.freeze({
              evidenceId: this.identities.createEvidenceId({
                provider: "helius",
                sourceKey,
                contentHash,
              }),
              provider: "helius" as const,
              method: "enhanced-transactions",
              requestedAt: input.requestedAt,
              respondedAt: response.receivedAt,
              sourceTimestamp: asTimestamp(new Date(transaction.timestamp * 1_000)),
              normalizedAt: response.receivedAt,
              sourceKey,
              contentHash,
              slot: asSolanaSlot(BigInt(transaction.slot)),
            }),
          }),
        );
      }
    }
    return Object.freeze(purchases);
  }
}
