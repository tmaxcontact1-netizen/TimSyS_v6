import { createHash } from "node:crypto";

import { z } from "zod";

import type { ObservationIdentityFactory } from "../../../application/contracts/observations.js";
import type {
  WalletHistoryObservationPort,
  WalletHistoryTransactionObservation,
} from "../../../application/services/portfolio-transaction-history.js";
import { asSolanaSlot, asTimestamp, type Timestamp } from "../../../domain/shared/types.js";
import type { BoundedJsonHttpTransport } from "../http-json.js";

const PAGE_SIZE = 100;
const MAXIMUM_PAGES = 100;
const transactionSchema = z.object({
  signature: z.string().min(1),
  slot: z.number().int().safe().nonnegative(),
  timestamp: z.number().int().safe().nonnegative(),
  transactionError: z.unknown().nullable().optional(),
  feePayer: z.string().min(1),
});
const pageSchema = z.array(transactionSchema).max(PAGE_SIZE);

const time = (value: Timestamp): number => new Date(value).getTime();
const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Reads complete wallet-initiated history back to an explicit authority boundary. */
export class HeliusWalletHistoryAdapter implements WalletHistoryObservationPort {
  public constructor(
    private readonly http: BoundedJsonHttpTransport,
    private readonly apiKey: string,
    private readonly identities: ObservationIdentityFactory,
  ) {
    if (apiKey.trim().length === 0) throw new TypeError("Helius API key is required");
  }

  public async observe(input: Parameters<WalletHistoryObservationPort["observe"]>[0]) {
    const transactions: WalletHistoryTransactionObservation[] = [];
    let before: string | null = null;
    let evidenceObservedAt = input.requestedAt;
    let reachedBoundary = false;
    for (let pageNumber = 0; pageNumber < MAXIMUM_PAGES; pageNumber += 1) {
      const endpoint = new URL(
        `https://api.helius.xyz/v0/addresses/${encodeURIComponent(input.wallet)}/transactions`,
      );
      endpoint.searchParams.set("api-key", this.apiKey);
      endpoint.searchParams.set("limit", String(PAGE_SIZE));
      if (before !== null) endpoint.searchParams.set("before", before);
      const response = await this.http.get(endpoint.toString());
      if (response.status === 429 || response.status >= 500)
        throw new Error("Helius wallet history is temporarily unavailable");
      if (response.status < 200 || response.status >= 300)
        throw new Error("Helius wallet history was rejected");
      const parsed = pageSchema.safeParse(response.body);
      if (!parsed.success) throw new Error("Malformed Helius wallet history response");
      evidenceObservedAt = response.receivedAt;
      if (parsed.data.length === 0) {
        reachedBoundary = true;
        break;
      }
      for (const item of parsed.data) {
        const occurredAt = asTimestamp(new Date(item.timestamp * 1_000));
        if (time(occurredAt) > time(input.requestedAt)) continue;
        if (time(occurredAt) < time(input.coverageRequiredAt)) {
          reachedBoundary = true;
          continue;
        }
        if (item.feePayer !== input.wallet) continue;
        const contentHash = hash(item);
        transactions.push(
          Object.freeze({
            signature: item.signature,
            occurredAt,
            successful: item.transactionError == null,
            slot: asSolanaSlot(BigInt(item.slot)),
            evidence: Object.freeze({
              id: this.identities.createEvidenceId({
                provider: "helius",
                sourceKey: item.signature,
                contentHash,
              }),
              provider: "helius" as const,
              observedAt: occurredAt,
              sourceKey: item.signature,
              slot: asSolanaSlot(BigInt(item.slot)),
              contentHash,
            }),
          }),
        );
      }
      if (reachedBoundary || parsed.data.length < PAGE_SIZE) {
        reachedBoundary = true;
        break;
      }
      before = parsed.data.at(-1)?.signature ?? null;
      if (before === null)
        throw new Error("Helius wallet history pagination cursor is unavailable");
    }
    if (!reachedBoundary) throw new Error("Helius wallet history coverage limit was exceeded");
    if (new Set(transactions.map(({ signature }) => signature)).size !== transactions.length)
      throw new Error("Helius wallet history returned duplicate signatures");
    return Object.freeze({
      wallet: input.wallet,
      requestedAt: input.requestedAt,
      coverageStartedAt: input.coverageRequiredAt,
      transactions: Object.freeze(transactions),
      evidenceObservedAt,
    });
  }
}
