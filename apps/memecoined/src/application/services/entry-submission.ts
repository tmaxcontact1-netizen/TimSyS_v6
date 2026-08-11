import type { EntrySubmissionRepository, PreparedEntryExecution } from "../ports/repositories.js";
import type { ExecutionAuthorityPort } from "../ports/runtime.js";
import type {
  LocalSignerPort,
  SubmissionReceipt,
  TransactionInspectorPort,
  TransactionSubmissionPort,
} from "../ports/signer.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import { asRawAmount } from "../../domain/shared/types.js";

export async function submitPreparedEntry(input: {
  readonly execution: PreparedEntryExecution;
  readonly repository: EntrySubmissionRepository;
  readonly inspector: TransactionInspectorPort;
  readonly signer: LocalSignerPort;
  readonly submission: TransactionSubmissionPort;
  readonly authority: ExecutionAuthorityPort;
}): Promise<SubmissionReceipt> {
  const deliveryId = `entry:${input.execution.orderId}`;
  const signedAt = input.authority.now();
  const identity = await input.signer.publicIdentity();
  if (identity !== input.execution.wallet)
    throw new InvariantViolationError("Configured signer does not match prepared entry wallet");
  const inspected = await input.inspector.inspect({
    serializedTransactionBase64: input.execution.serializedTransactionBase64,
    transactionFingerprint: input.execution.transactionFingerprint,
    expectedWallet: input.execution.wallet,
    currentBlockHeight: await input.authority.currentBlockHeight(),
    lastValidBlockHeight: input.execution.lastValidBlockHeight,
    prioritizationFeeLamports: asRawAmount(input.execution.prioritizationFeeLamports),
  });
  const signed = await input.signer.sign(inspected);
  if (
    signed.wallet !== input.execution.wallet ||
    signed.unsignedTransactionFingerprint !== input.execution.transactionFingerprint
  )
    throw new InvariantViolationError("Signed transaction does not match prepared entry");
  await input.repository.recordSigning({
    orderId: input.execution.orderId,
    deliveryId,
    signedAt,
    signedTransaction: signed,
  });
  const receipt = await input.submission.submit(signed, deliveryId);
  if (receipt.signature !== signed.signature)
    throw new InvariantViolationError("Entry submission acknowledgement signature mismatch");
  if (receipt.acknowledgedAt < signedAt)
    throw new InvariantViolationError("Entry submission acknowledgement predates signing");
  await input.repository.recordSubmission({
    orderId: input.execution.orderId,
    deliveryId,
    submittedAt: receipt.acknowledgedAt,
    receipt,
  });
  return receipt;
}
