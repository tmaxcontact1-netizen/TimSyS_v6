import { expect, it } from "vitest";
import { PostgresPreparedEntryExecutionSource } from "../../src/infrastructure/database/prepared-entry-executions.js";

it("selects only human-approved unexpired signing work with all consumption bindings", async () => {
  let statement = "";
  const source = new PostgresPreparedEntryExecutionSource({
    query: async (sql: string) => {
      statement = sql;
      return { rowCount: 1, rows: [{
        order_id: "00000000-0000-4000-8000-000000000991",
        wallet_address: "wallet", transaction_fingerprint: "transaction",
        transaction_base64: "AQ==", last_valid_block_height: "100",
        prioritization_fee_lamports: "5000", intended_input_amount: "25000000",
        quote_fingerprint: "quote", approval_id: "00000000-0000-4000-8000-000000000992",
        eligibility_hash: "e".repeat(64),
      }] };
    },
  } as never);
  await expect(source.nextBatch()).resolves.toEqual([
    expect.objectContaining({
      intendedInputAmount: 25_000_000n, quoteFingerprint: "quote",
      approvalId: "00000000-0000-4000-8000-000000000992",
    }),
  ]);
  expect(statement).toMatch(/a\.state='approved'.*a\.expires_at>=now\(\)/s);
  expect(statement).toMatch(/a\.quote_fingerprint=o\.quote_fingerprint/);
});
