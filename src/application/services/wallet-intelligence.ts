import type { WalletConfirmation } from "../../domain/candidate/scoring.js";
import {
  classifyWalletConfirmation,
  type WalletConfirmationInput,
} from "../../domain/wallet/classifier.js";
import type { WalletPerformanceSnapshot, WalletQualification } from "../../domain/wallet/model.js";
import { qualifyWallet } from "../../domain/wallet/performance.js";

export interface WalletIntelligenceRepository {
  saveQualification(input: {
    readonly snapshot: WalletPerformanceSnapshot;
    readonly qualification: WalletQualification;
  }): Promise<void>;
  saveConfirmation(input: {
    readonly confirmationId: string;
    readonly candidateId: string;
    readonly confirmation: WalletConfirmation;
    readonly facts: WalletConfirmationInput;
  }): Promise<void>;
}

export async function qualifyAndPersistWallet(input: {
  readonly snapshot: WalletPerformanceSnapshot;
  readonly repository: WalletIntelligenceRepository;
}): Promise<WalletQualification> {
  const qualification = qualifyWallet(input.snapshot);
  await input.repository.saveQualification({ snapshot: input.snapshot, qualification });
  return qualification;
}

export async function confirmAndPersistWallets(input: {
  readonly confirmationId: string;
  readonly candidateId: string;
  readonly facts: WalletConfirmationInput;
  readonly repository: WalletIntelligenceRepository;
}): Promise<WalletConfirmation> {
  if (input.confirmationId.trim().length === 0 || input.candidateId.trim().length === 0)
    throw new TypeError("Wallet confirmation and candidate IDs are required");
  const confirmation = classifyWalletConfirmation(input.facts);
  await input.repository.saveConfirmation({ ...input, confirmation });
  return confirmation;
}
