import { Decimal } from "decimal.js";

import type { EntryPreparationRepository } from "../ports/repositories.js";
import type { LocalSignerPort } from "../ports/signer.js";
import type { SwapPort } from "../ports/swap.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asBasisPoints,
  asNonNegativeDecimal,
  asRawAmount,
  type MintAddress,
  type OrderId,
  type SignalId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";
import { createEntryApproval, createEntryGateSnapshot } from "../../domain/trading/quote.js";
import { WRAPPED_SOL_MINT } from "./portfolio-inventory-valuation.js";
import { prepareEntry } from "./entry-preparation.js";
import type { OperatorApprovalRequest, OperatorApprovalService } from "./operator-approval.js";

const SLIPPAGE = asBasisPoints(150n);
const LAMPORTS_PER_SOL = new Decimal(1_000_000_000);

export interface LiveEntryPlanningWork {
  readonly signalId: SignalId;
  readonly orderId: OrderId;
  readonly mint: MintAddress;
  readonly wallet: WalletAddress;
  readonly inputAmountLamports: bigint;
  readonly eligibilityHash: string;
  readonly securityRulesPassed: boolean;
  readonly exposureRulesPassed: boolean;
}

function failure(stage: string, result: { ok: false; error: { reason: string } }): never {
  throw new Error(`Live entry ${stage} unavailable: ${result.error.reason}`);
}

export async function prepareLiveEntryForHumanApproval(input: {
  readonly work: LiveEntryPlanningWork;
  readonly swap: SwapPort;
  readonly signer: Pick<LocalSignerPort, "publicIdentity">;
  readonly repository: EntryPreparationRepository;
  readonly approvals: OperatorApprovalService;
  readonly notify: (message: string) => Promise<void>;
  readonly now: () => Timestamp;
}): Promise<OperatorApprovalRequest> {
  if (input.work.inputAmountLamports <= 0n)
    throw new InvariantViolationError("Live entry amount must be positive");
  if (!input.work.securityRulesPassed || !input.work.exposureRulesPassed)
    throw new InvariantViolationError("Live entry requires current security and exposure approval");
  if ((await input.signer.publicIdentity()) !== input.work.wallet)
    throw new InvariantViolationError("Live entry planning wallet does not match the signer");

  const requestedAt = input.now();
  const entryResult = await input.swap.quote({
    inputMint: WRAPPED_SOL_MINT,
    outputMint: input.work.mint,
    inputAmount: asRawAmount(input.work.inputAmountLamports),
    slippageBasisPoints: SLIPPAGE,
    requestedAt,
  });
  if (!entryResult.ok) failure("quote", entryResult);
  const entryQuote = entryResult.value;
  const reverseResult = await input.swap.quote({
    inputMint: input.work.mint,
    outputMint: WRAPPED_SOL_MINT,
    inputAmount: entryQuote.expectedOutputAmount,
    slippageBasisPoints: SLIPPAGE,
    requestedAt: input.now(),
  });
  if (!reverseResult.ok) failure("reverse quote", reverseResult);
  const constructionResult = await input.swap.construct({
    quote: entryQuote,
    wallet: input.work.wallet,
    requestedAt: input.now(),
  });
  if (!constructionResult.ok) failure("construction", constructionResult);
  const simulationResult = await input.swap.simulate(constructionResult.value, input.now());
  if (!simulationResult.ok) failure("simulation", simulationResult);
  const evaluatedAt = input.now();
  const snapshot = createEntryGateSnapshot({
    stage: "approval",
    evaluatedAt,
    entryQuote,
    reverseQuote: reverseResult.value,
    positionValueSol: asNonNegativeDecimal(
      new Decimal(input.work.inputAmountLamports.toString()).div(LAMPORTS_PER_SOL),
    ),
    estimatedExecutionCostsSol: asNonNegativeDecimal(
      new Decimal(constructionResult.value.prioritizationFeeLamports.toString()).div(LAMPORTS_PER_SOL),
    ),
    simulation: simulationResult.value.result,
    finalRecalculation: {
      securityRulesPassed: input.work.securityRulesPassed,
      exposureRulesPassed: input.work.exposureRulesPassed,
      quoteFingerprint: entryQuote.fingerprint,
    },
    approval: createEntryApproval({
      issuedAt: evaluatedAt,
      eligibilityHash: input.work.eligibilityHash,
      quoteFingerprint: entryQuote.fingerprint,
    }),
    currentEligibilityHash: input.work.eligibilityHash,
    submissionFailed: false,
  });
  const decision = await prepareEntry({
    signalId: input.work.signalId,
    orderId: input.work.orderId,
    snapshot,
    constructedSwap: constructionResult.value,
    repository: input.repository,
  });
  if (!decision.eligible)
    throw new InvariantViolationError(`Live entry gate refused: ${decision.failedRuleIds.join(",")}`);
  const payload = {
    orderId: input.work.orderId,
    wallet: input.work.wallet,
    intendedInputAmount: input.work.inputAmountLamports,
    quoteFingerprint: entryQuote.fingerprint,
    transactionFingerprint: constructionResult.value.fingerprint,
    prioritizationFeeLamports: constructionResult.value.prioritizationFeeLamports,
  };
  const approval = await input.approvals.request({
    actionType: "entry",
    targetType: "order",
    targetId: input.work.orderId,
    payload,
    eligibilityHash: input.work.eligibilityHash,
    quoteFingerprint: entryQuote.fingerprint,
    requestedBy: "entry-planner",
  });
  await input.notify(
    `Entry approval requested\nMint: ${input.work.mint}\nAmount: ${input.work.inputAmountLamports} lamports\nApproval: ${approval.id}\nNonce: ${approval.nonce}\nExpires: ${approval.expiresAt}`,
  );
  return approval;
}
