import { createHash } from "node:crypto";

import type {
  InspectedTransaction,
  TransactionInspectionRequest,
  TransactionInspectorPort,
} from "../../application/ports/signer.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { RawAmount, WalletAddress } from "../../domain/shared/types.js";

export interface ParsedAssetTransfer {
  readonly mint: string;
  readonly sourceOwner: string;
  readonly destinationOwner: string;
  readonly amount: bigint;
}

export interface ParsedTransactionInspection {
  readonly requiredSigners: readonly string[];
  readonly programIds: readonly string[];
  readonly feePayer: string;
  readonly feeRecipients: readonly string[];
  readonly assetTransfers: readonly ParsedAssetTransfer[];
  readonly prioritizationFeeLamports: RawAmount;
}

export interface TransactionInspectionParser {
  parse(serializedTransactionBase64: string): Promise<ParsedTransactionInspection>;
}

export interface TransactionInspectionPolicy {
  readonly allowedProgramIds: ReadonlySet<string>;
  readonly allowedFeeRecipients: ReadonlySet<string>;
  readonly allowedDestinationOwners: ReadonlySet<string>;
  readonly maximumPrioritizationFeeLamports: RawAmount;
}

function requireBase64(value: string): Buffer {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new InvariantViolationError("Transaction payload is not canonical base64");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== value)
    throw new InvariantViolationError("Transaction payload is not canonical base64");
  return bytes;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export class TransactionInspector implements TransactionInspectorPort {
  public constructor(
    private readonly parser: TransactionInspectionParser,
    private readonly policy: TransactionInspectionPolicy,
  ) {}

  public async inspect(request: TransactionInspectionRequest): Promise<InspectedTransaction> {
    const bytes = requireBase64(request.serializedTransactionBase64);
    const fingerprint = createHash("sha256").update(bytes).digest("hex");
    if (fingerprint !== request.transactionFingerprint)
      throw new InvariantViolationError("Transaction fingerprint mismatch");
    if (request.currentBlockHeight < 0n || request.lastValidBlockHeight < 0n)
      throw new InvariantViolationError("Transaction block heights must be non-negative");
    if (request.currentBlockHeight > request.lastValidBlockHeight)
      throw new InvariantViolationError("Transaction blockhash has expired");
    if (request.prioritizationFeeLamports > this.policy.maximumPrioritizationFeeLamports)
      throw new InvariantViolationError("Transaction priority fee exceeds policy");

    const parsed = await this.parser.parse(request.serializedTransactionBase64);
    if (!unique(parsed.requiredSigners) || parsed.requiredSigners.length !== 1)
      throw new InvariantViolationError("Transaction requires an unauthorized signer");
    if (
      parsed.requiredSigners[0] !== request.expectedWallet ||
      parsed.feePayer !== request.expectedWallet
    )
      throw new InvariantViolationError(
        "Transaction signer or fee payer is not the trading wallet",
      );
    if (parsed.prioritizationFeeLamports !== request.prioritizationFeeLamports)
      throw new InvariantViolationError("Transaction priority fee differs from preparation");
    if (
      parsed.programIds.length === 0 ||
      parsed.programIds.some((id) => !this.policy.allowedProgramIds.has(id))
    )
      throw new InvariantViolationError("Transaction invokes an unauthorized program");
    if (parsed.feeRecipients.some((recipient) => !this.policy.allowedFeeRecipients.has(recipient)))
      throw new InvariantViolationError("Transaction contains an unexpected fee recipient");
    for (const transfer of parsed.assetTransfers) {
      if (transfer.amount <= 0n)
        throw new InvariantViolationError("Transaction contains an invalid transfer");
      if (
        transfer.destinationOwner !== request.expectedWallet &&
        !this.policy.allowedDestinationOwners.has(transfer.destinationOwner)
      )
        throw new InvariantViolationError("Transaction contains an unexpected asset transfer");
    }
    return Object.freeze({
      serializedTransactionBase64: request.serializedTransactionBase64,
      transactionFingerprint: fingerprint,
      wallet: request.expectedWallet as WalletAddress,
    });
  }
}
