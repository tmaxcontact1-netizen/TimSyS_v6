import {
  AccountRole,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import { SolanaWireTransactionInspectionParser } from "../../src/infrastructure/providers/solana/instruction-parser.js";

const wallet = "7v91N7iZCHkQA24cHoh8naDjv92rSJNxq73hhSnMuVv4";
const recipient = "4vJ9JU1bJJE96FWSJKvHsmmFcfRWPQjtL4i6Z6hFMLW";
const system = "11111111111111111111111111111111";
const compute = "ComputeBudget111111111111111111111111111111";

function computeLimit(units: number): object {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return { programAddress: compute, data };
}

function computePrice(microLamports: bigint): object {
  const data = new Uint8Array(9);
  data[0] = 3;
  new DataView(data.buffer).setBigUint64(1, microLamports, true);
  return { programAddress: compute, data };
}

function transferData(lamports: bigint): Uint8Array {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(4, lamports, true);
  return bytes;
}

function transaction(instructions: readonly object[]): string {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayer(wallet as never, value),
    (value) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: system as never, lastValidBlockHeight: 1_000n },
        value,
      ),
    (value) => appendTransactionMessageInstructions(instructions as never, value),
  );
  return getBase64EncodedWireTransaction(compileTransaction(message));
}

describe("production Solana instruction parser", () => {
  it("extracts authority, programs, exact priority fee, and system recipients", async () => {
    const payload = transaction([
      computeLimit(200_000),
      computePrice(5_000n),
      {
        programAddress: system,
        accounts: [
          { address: wallet, role: AccountRole.WRITABLE_SIGNER },
          { address: recipient, role: AccountRole.WRITABLE },
        ],
        data: transferData(50_000n),
      },
    ]);
    const parsed = await new SolanaWireTransactionInspectionParser().parse(payload);
    expect(parsed.requiredSigners).toEqual([wallet]);
    expect(parsed.feePayer).toBe(wallet);
    expect(parsed.feeRecipients).toEqual([recipient]);
    expect(parsed.prioritizationFeeLamports).toBe(1_000n);
    expect(parsed.programIds).toContain(system);
  });

  it("rejects truncated wire data and incomplete compute-budget declarations", async () => {
    const parser = new SolanaWireTransactionInspectionParser();
    await expect(parser.parse(Buffer.from("bad").toString("base64"))).rejects.toThrow(/malformed/);
    await expect(parser.parse(transaction([computeLimit(200_000)]))).rejects.toThrow(
      /price and limit/,
    );
  });
});
