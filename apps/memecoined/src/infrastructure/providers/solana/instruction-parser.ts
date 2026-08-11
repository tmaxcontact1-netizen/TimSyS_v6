import { getCompiledTransactionMessageDecoder, getTransactionDecoder } from "@solana/kit";

import { InvariantViolationError } from "../../../domain/shared/errors.js";
import { asRawAmount } from "../../../domain/shared/types.js";
import type {
  ParsedAssetTransfer,
  ParsedTransactionInspection,
  TransactionInspectionParser,
} from "../../security/transaction-inspector.js";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);
const MAX_TRANSACTION_BYTES = 1_232;
const MICRO_LAMPORTS_PER_LAMPORT = 1_000_000n;

function canonicalBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new InvariantViolationError("Transaction payload is not canonical base64");
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.length === 0 ||
    bytes.length > MAX_TRANSACTION_BYTES ||
    bytes.toString("base64") !== value
  )
    throw new InvariantViolationError("Transaction payload size or encoding is invalid");
  return bytes;
}

function u32(bytes: Uint8Array, offset = 0): number {
  if (bytes.length < offset + 4) throw new InvariantViolationError("Instruction data is truncated");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function u64(bytes: Uint8Array, offset: number): bigint {
  if (bytes.length < offset + 8) throw new InvariantViolationError("Instruction data is truncated");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset, true);
}

function account(
  staticAccounts: readonly string[],
  indices: readonly number[] | undefined,
  index: number,
): string {
  const addressIndex = indices?.[index];
  const address = addressIndex === undefined ? undefined : staticAccounts[addressIndex];
  if (address === undefined)
    throw new InvariantViolationError("Instruction account is unavailable");
  return address;
}

/**
 * Parses only self-contained legacy/v0 wire messages. Address lookup tables require live account
 * resolution and are rejected so inspection can never authorize a partially understood message.
 */
export class SolanaWireTransactionInspectionParser implements TransactionInspectionParser {
  public async parse(serializedTransactionBase64: string): Promise<ParsedTransactionInspection> {
    let decoded;
    let message;
    try {
      decoded = getTransactionDecoder().decode(canonicalBase64(serializedTransactionBase64));
      message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
    } catch (error) {
      if (error instanceof InvariantViolationError) throw error;
      throw new InvariantViolationError("Solana transaction wire message is malformed");
    }
    if (message.version === 1)
      throw new InvariantViolationError("Solana v1 transaction inspection is unsupported");
    if (message.version === 0 && (message.addressTableLookups?.length ?? 0) > 0)
      throw new InvariantViolationError("Address lookup transactions require resolved accounts");
    if (message.header.numSignerAccounts < 1 || message.staticAccounts.length === 0)
      throw new InvariantViolationError("Transaction has no fee payer");

    const requiredSigners = message.staticAccounts.slice(0, message.header.numSignerAccounts);
    const programIds: string[] = [];
    const feeRecipients: string[] = [];
    const assetTransfers: ParsedAssetTransfer[] = [];
    let computeUnitLimit: bigint | null = null;
    let computeUnitPrice: bigint | null = null;

    for (const instruction of message.instructions) {
      const program = message.staticAccounts[instruction.programAddressIndex];
      if (program === undefined)
        throw new InvariantViolationError("Instruction program is unavailable");
      programIds.push(program);
      const data = Uint8Array.from(instruction.data ?? []);
      if (program === COMPUTE_BUDGET_PROGRAM) {
        if (data[0] === 2) {
          if (computeUnitLimit !== null)
            throw new InvariantViolationError("Compute-unit limit is specified more than once");
          computeUnitLimit = BigInt(u32(data, 1));
        } else if (data[0] === 3) {
          if (computeUnitPrice !== null)
            throw new InvariantViolationError("Compute-unit price is specified more than once");
          computeUnitPrice = u64(data, 1);
        }
      } else if (program === SYSTEM_PROGRAM && data.length >= 12 && u32(data) === 2) {
        const source = account(message.staticAccounts, instruction.accountIndices, 0);
        const destination = account(message.staticAccounts, instruction.accountIndices, 1);
        if (u64(data, 4) > 0n && source === message.staticAccounts[0])
          feeRecipients.push(destination);
      } else if (TOKEN_PROGRAMS.has(program) && (data[0] === 3 || data[0] === 12)) {
        const checked = data[0] === 12;
        const source = account(message.staticAccounts, instruction.accountIndices, 0);
        const mint = checked
          ? account(message.staticAccounts, instruction.accountIndices, 1)
          : "unresolved-token-mint";
        const destination = account(
          message.staticAccounts,
          instruction.accountIndices,
          checked ? 2 : 1,
        );
        assetTransfers.push(
          Object.freeze({
            mint,
            sourceOwner: source,
            destinationOwner: destination,
            amount: u64(data, 1),
          }),
        );
      }
    }

    if ((computeUnitLimit === null) !== (computeUnitPrice === null))
      throw new InvariantViolationError("Compute-unit price and limit must be specified together");
    const prioritizationFeeLamports =
      computeUnitLimit === null || computeUnitPrice === null
        ? 0n
        : (computeUnitLimit * computeUnitPrice + MICRO_LAMPORTS_PER_LAMPORT - 1n) /
          MICRO_LAMPORTS_PER_LAMPORT;
    return Object.freeze({
      requiredSigners: Object.freeze(requiredSigners),
      programIds: Object.freeze([...new Set(programIds)]),
      feePayer: message.staticAccounts[0]!,
      feeRecipients: Object.freeze([...new Set(feeRecipients)]),
      assetTransfers: Object.freeze(assetTransfers),
      prioritizationFeeLamports: asRawAmount(prioritizationFeeLamports),
    });
  }
}
