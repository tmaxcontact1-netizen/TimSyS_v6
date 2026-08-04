import { createHash } from "node:crypto";

import {
  createKeyPairSignerFromBytes,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  getTransactionDecoder,
  type KeyPairSigner,
} from "@solana/kit";

import type {
  InspectedTransaction,
  LocalSignerPort,
  SignedTransaction,
} from "../../application/ports/signer.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { WalletAddress } from "../../domain/shared/types.js";

export interface WalletSecretSource {
  loadKeypairBytes(): Promise<Readonly<Uint8Array>>;
}

export class LocalTransactionSigner implements LocalSignerPort {
  private signerPromise: Promise<KeyPairSigner> | null = null;

  public constructor(private readonly secrets: WalletSecretSource) {}

  private signer(): Promise<KeyPairSigner> {
    this.signerPromise ??= this.secrets.loadKeypairBytes().then(async (bytes) => {
      if (bytes.length !== 64)
        throw new InvariantViolationError("Wallet keypair must contain 64 bytes");
      return createKeyPairSignerFromBytes(new Uint8Array(bytes));
    });
    return this.signerPromise;
  }

  public async publicIdentity(): Promise<WalletAddress> {
    return (await this.signer()).address as unknown as WalletAddress;
  }

  public async sign(transaction: InspectedTransaction): Promise<SignedTransaction> {
    const signer = await this.signer();
    if ((signer.address as string) !== (transaction.wallet as string))
      throw new InvariantViolationError("Local signer does not match inspected wallet");
    let decoded;
    try {
      decoded = getTransactionDecoder().decode(
        Buffer.from(transaction.serializedTransactionBase64, "base64"),
      );
    } catch {
      throw new InvariantViolationError("Inspected transaction cannot be decoded for signing");
    }
    const requiredSigners = Object.keys(decoded.signatures);
    if (requiredSigners.length !== 1 || requiredSigners[0] !== signer.address)
      throw new InvariantViolationError("Decoded transaction requires an unauthorized signer");
    const [signatures] = await signer.signTransactions([decoded as never]);
    if (signatures === undefined || signatures[signer.address] === undefined)
      throw new InvariantViolationError("Local signer did not produce the required signature");
    const signed = Object.freeze({
      ...decoded,
      signatures: Object.freeze({ ...decoded.signatures, ...signatures }),
    });
    const serializedTransactionBase64 = getBase64EncodedWireTransaction(signed);
    const signedTransactionFingerprint = createHash("sha256")
      .update(Buffer.from(serializedTransactionBase64, "base64"))
      .digest("hex");
    return Object.freeze({
      serializedTransactionBase64,
      unsignedTransactionFingerprint: transaction.transactionFingerprint,
      signedTransactionFingerprint,
      signature: getSignatureFromTransaction(signed),
      wallet: transaction.wallet,
    });
  }
}
