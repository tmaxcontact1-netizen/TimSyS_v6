import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";
import {
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getTransactionDecoder,
  isFullySignedTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";

import { asRawAmount } from "../../src/domain/shared/types.js";
import {
  TransactionInspector,
  type ParsedTransactionInspection,
} from "../../src/infrastructure/security/transaction-inspector.js";
import { LocalTransactionSigner } from "../../src/infrastructure/security/local-signer.js";

const wallet = "Wallet111111111111111111111111111111111111" as never;
const payload = Buffer.from("approved-transaction").toString("base64");
const fingerprint = createHash("sha256").update(Buffer.from(payload, "base64")).digest("hex");
const parsed: ParsedTransactionInspection = Object.freeze({
  requiredSigners: Object.freeze([wallet]),
  programIds: Object.freeze(["JupiterProgram", "TokenProgram"]),
  feePayer: wallet,
  feeRecipients: Object.freeze(["JupiterFeeVault"]),
  assetTransfers: Object.freeze([
    Object.freeze({
      mint: "TokenMint",
      sourceOwner: wallet,
      destinationOwner: "PoolVault",
      amount: 10n,
    }),
  ]),
  prioritizationFeeLamports: asRawAmount(5_000n),
});

function inspector(value: ParsedTransactionInspection = parsed) {
  return new TransactionInspector(
    { parse: async () => value },
    {
      allowedProgramIds: new Set(["JupiterProgram", "TokenProgram"]),
      allowedFeeRecipients: new Set(["JupiterFeeVault"]),
      allowedDestinationOwners: new Set(["PoolVault"]),
      maximumPrioritizationFeeLamports: asRawAmount(10_000n),
    },
  );
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    serializedTransactionBase64: payload,
    transactionFingerprint: fingerprint,
    expectedWallet: wallet,
    currentBlockHeight: 900n,
    lastValidBlockHeight: 1_000n,
    prioritizationFeeLamports: asRawAmount(5_000n),
    ...overrides,
  } as never;
}

describe("transaction inspection", () => {
  it("accepts an exact allowlisted transaction", async () => {
    await expect(inspector().inspect(request())).resolves.toMatchObject({
      transactionFingerprint: fingerprint,
      wallet,
    });
  });

  it.each([
    ["altered payload", { transactionFingerprint: "0".repeat(64) }, parsed],
    ["expired blockhash", { currentBlockHeight: 1_001n }, parsed],
    ["excess priority fee", { prioritizationFeeLamports: asRawAmount(10_001n) }, parsed],
    ["unknown signer", {}, { ...parsed, requiredSigners: [wallet, "OtherSigner"] }],
    ["unknown program", {}, { ...parsed, programIds: ["UnknownProgram"] }],
    ["unknown fee recipient", {}, { ...parsed, feeRecipients: ["UnknownVault"] }],
    [
      "unknown transfer",
      {},
      {
        ...parsed,
        assetTransfers: [
          { mint: "TokenMint", sourceOwner: "Other", destinationOwner: "Unknown", amount: 1n },
        ],
      },
    ],
  ])("rejects %s", async (_label, overrides, value) => {
    await expect(
      inspector(value as ParsedTransactionInspection).inspect(request(overrides)),
    ).rejects.toThrow();
  });
});

describe("local transaction signing", () => {
  it("signs the exact inspected transaction with the configured local wallet", async () => {
    const keypair = new Uint8Array([
      7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
      7, 234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249, 149, 71, 118, 174,
      190, 190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44,
    ]);
    const signer = new LocalTransactionSigner({ loadKeypairBytes: async () => keypair });
    const identity = await signer.publicIdentity();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (value) => setTransactionMessageFeePayer(identity as never, value),
      (value) =>
        setTransactionMessageLifetimeUsingBlockhash(
          { blockhash: "11111111111111111111111111111111" as never, lastValidBlockHeight: 1_000n },
          value,
        ),
    );
    const unsigned = getBase64EncodedWireTransaction(compileTransaction(message));
    const unsignedFingerprint = createHash("sha256")
      .update(Buffer.from(unsigned, "base64"))
      .digest("hex");
    const signed = await signer.sign({
      serializedTransactionBase64: unsigned,
      transactionFingerprint: unsignedFingerprint,
      wallet: identity,
    });
    expect(signed.unsignedTransactionFingerprint).toBe(unsignedFingerprint);
    expect(signed.wallet).toBe(identity);
    expect(signed.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(
      isFullySignedTransaction(
        getTransactionDecoder().decode(Buffer.from(signed.serializedTransactionBase64, "base64")),
      ),
    ).toBe(true);
  });
});
