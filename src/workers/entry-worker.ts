import type { EntryPreparationRepository } from "../application/ports/repositories.js";
import type { ConstructedSwap } from "../application/ports/swap.js";
import { prepareEntry } from "../application/services/entry-preparation.js";
import type { OrderId, SignalId } from "../domain/shared/types.js";
import type { EntryGateDecision, EntryGateSnapshot } from "../domain/trading/quote.js";

export interface EntryPreparationWork {
  readonly signalId: SignalId;
  readonly orderId: OrderId;
  readonly snapshot: EntryGateSnapshot;
  readonly constructedSwap: ConstructedSwap | null;
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
