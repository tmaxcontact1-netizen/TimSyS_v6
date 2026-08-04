import type { EntryPreparationRepository } from "../ports/repositories.js";
import type { ConstructedSwap } from "../ports/swap.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { OrderId, SignalId } from "../../domain/shared/types.js";
import {
  evaluateEntryGate,
  type EntryGateDecision,
  type EntryGateSnapshot,
} from "../../domain/trading/quote.js";

export async function prepareEntry(input: {
  readonly signalId: SignalId;
  readonly orderId: OrderId;
  readonly snapshot: EntryGateSnapshot;
  readonly constructedSwap: ConstructedSwap | null;
  readonly repository: EntryPreparationRepository;
}): Promise<EntryGateDecision> {
  if (input.snapshot.stage !== "approval")
    throw new InvariantViolationError("Entry preparation requires the approval gate");
  const decision = evaluateEntryGate(input.snapshot);
  const quote = input.snapshot.entryQuote;
  if (decision.eligible) {
    if (quote === null || input.constructedSwap === null)
      throw new InvariantViolationError("Eligible entry requires a constructed transaction");
    if (
      input.constructedSwap.quoteFingerprint !== quote.fingerprint ||
      input.constructedSwap.requestedAt > input.snapshot.evaluatedAt ||
      input.constructedSwap.receivedAt > input.snapshot.evaluatedAt
    )
      throw new InvariantViolationError(
        "Constructed transaction is not bound to the approved quote",
      );
  }
  await input.repository.saveEntryPreparation({
    signalId: input.signalId,
    orderId: input.orderId,
    evaluatedAt: input.snapshot.evaluatedAt,
    snapshot: input.snapshot,
    decision,
    constructedSwap: decision.eligible ? input.constructedSwap : null,
  });
  return decision;
}
