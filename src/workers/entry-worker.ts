import type { EntryPreparationRepository } from "../application/ports/repositories.js";
import type { ConstructedSwap } from "../application/ports/swap.js";
import { prepareEntry } from "../application/services/entry-preparation.js";
import type { OrderId, SignalId } from "../domain/shared/types.js";
import type { EntryGateDecision, EntryGateSnapshot } from "../domain/trading/quote.js";
import type {
  PreparedEntryExecution,
  EntrySubmissionRepository,
} from "../application/ports/repositories.js";
import type { ExecutionAuthorityPort } from "../application/ports/runtime.js";
import type {
  LocalSignerPort,
  TransactionInspectorPort,
  TransactionSubmissionPort,
  SubmissionReceipt,
} from "../application/ports/signer.js";
import { submitPreparedEntry } from "../application/services/entry-submission.js";

export interface EntryPreparationWork {
  readonly signalId: SignalId;
  readonly orderId: OrderId;
  readonly snapshot: EntryGateSnapshot;
  readonly constructedSwap: ConstructedSwap | null;
}

export async function runEntrySubmissionWorkerCycle(dependencies: {
  readonly source: { nextBatch(): Promise<readonly PreparedEntryExecution[]> };
  readonly repository: EntrySubmissionRepository;
  readonly inspector: TransactionInspectorPort;
  readonly signer: LocalSignerPort;
  readonly submission: TransactionSubmissionPort;
  readonly authority: ExecutionAuthorityPort;
  readonly batchSize?: number;
}): Promise<readonly SubmissionReceipt[]> {
  const limit = dependencies.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Entry submission batch size must be between 1 and 1000");
  const work = await dependencies.source.nextBatch();
  if (work.length > limit)
    throw new RangeError("Entry submission source exceeded the requested batch size");
  const receipts: SubmissionReceipt[] = [];
  for (const execution of work)
    receipts.push(await submitPreparedEntry({ ...dependencies, execution }));
  return Object.freeze(receipts);
}
export async function runEntryWorkerCycle(dependencies: {
  readonly source: { nextBatch(): Promise<readonly EntryPreparationWork[]> };
  readonly repository: EntryPreparationRepository;
  readonly batchSize?: number;
}): Promise<readonly EntryGateDecision[]> {
  const limit = dependencies.batchSize ?? 25;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new RangeError("Entry batch size must be between 1 and 1000");
  const work = await dependencies.source.nextBatch();
  if (work.length > limit) throw new RangeError("Entry source exceeded the requested batch size");
  const decisions: EntryGateDecision[] = [];
  for (const item of work)
    decisions.push(await prepareEntry({ ...item, repository: dependencies.repository }));
  return Object.freeze(decisions);
}
