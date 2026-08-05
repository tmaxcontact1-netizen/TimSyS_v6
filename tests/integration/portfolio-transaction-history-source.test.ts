import { describe, expect, it } from "vitest";

import {
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { PostgresPortfolioTransactionHistorySource } from "../../src/infrastructure/database/portfolio-transaction-history.js";

const observedAt = asTimestamp("2026-08-05T12:00:00Z");
const startedAt = asTimestamp("2026-08-01T00:00:00Z");
const wallet = "wallet" as WalletAddress;
const evidence = Object.freeze({
  id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000001"),
  provider: "helius" as const,
  observedAt,
  sourceKey: "unknown-signature",
  slot: asSolanaSlot(10n),
  contentHash: "a".repeat(64),
});

class Database {
  readonly queries: string[] = [];
  readonly client = {
    query: async (text: string) => {
      this.queries.push(text.trim());
      if (text.includes("min(started_at)"))
        return { rows: [{ started_at: startedAt }], rowCount: 1 };
      if (text.includes("INSERT INTO wallet_transaction_observations"))
        return { rows: [{ signature: "unknown-signature" }], rowCount: 1 };
      if (text.includes("FROM audit_events") && text.includes("details_json"))
        return { rows: [], rowCount: 0 };
      if (text.includes("FROM wallet_transaction_observations"))
        return {
          rows: [
            {
              signature: "unknown-signature",
              occurred_at: observedAt,
              successful: true,
              evidence_json: {
                ...evidence,
                id: evidence.id,
                slot: evidence.slot.toString(),
              },
            },
          ],
          rowCount: 1,
        };
      if (text.includes("SELECT signature FROM entry_submission_attempts"))
        return { rows: [{ signature: "known-signature" }], rowCount: 1 };
      return { rows: [], rowCount: text.includes("INSERT INTO") ? 1 : 0 };
    },
    release: () => undefined,
  };
  async connect() {
    return this.client;
  }
}

describe("durable portfolio transaction-history source", () => {
  it("atomically records complete live coverage and reconstructs authorization inputs", async () => {
    const database = new Database();
    const source = new PostgresPortfolioTransactionHistorySource(
      database as never,
      {
        observe: async () => ({
          wallet,
          requestedAt: observedAt,
          coverageStartedAt: startedAt,
          evidenceObservedAt: observedAt,
          transactions: [
            {
              signature: "unknown-signature",
              occurredAt: observedAt,
              successful: true,
              slot: asSolanaSlot(10n),
              evidence,
            },
          ],
        }),
      },
      wallet,
    );
    const result = await source.observe(observedAt);
    expect(result.coverageStartedAt).toBe(startedAt);
    expect(result.walletInitiatedTransactions[0]?.signature).toBe("unknown-signature");
    expect(result.authorizedSignatures).toEqual(["known-signature"]);
    expect(database.queries).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
    expect(database.queries.some((query) => query.includes("exit_submission_authority"))).toBe(
      true,
    );
  });
});
