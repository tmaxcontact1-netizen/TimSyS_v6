import type { RawAmount, Timestamp, WalletAddress } from "../../domain/shared/types.js";

export interface TransactionInspectionRequest {
  readonly serializedTransactionBase64: string;
  readonly transactionFingerprint: string;
  readonly expectedWallet: WalletAddress;
  readonly currentBlockHeight: bigint;
  readonly lastValidBlockHeight: bigint;
  readonly prioritizationFeeLamports: RawAmount;
}

export interface InspectedTransaction {
  readonly serializedTransactionBase64: string;
  readonly transactionFingerprint: string;
  readonly wallet: WalletAddress;
}

export interface SignedTransaction {
  readonly serializedTransactionBase64: string;
  readonly unsignedTransactionFingerprint: string;
  readonly signedTransactionFingerprint: string;
  readonly signature: string;
  readonly wallet: WalletAddress;
}

export interface TransactionInspectorPort {
  inspect(request: TransactionInspectionRequest): Promise<InspectedTransaction>;
}

export interface LocalSignerPort {
  publicIdentity(): Promise<WalletAddress>;
  sign(transaction: InspectedTransaction): Promise<SignedTransaction>;
}

export interface SubmissionReceipt {
  readonly provider: "helius" | "solana_rpc";
  readonly signature: string;
  readonly acknowledgedAt: Timestamp;
}

export interface TransactionSubmissionPort {
  submit(transaction: SignedTransaction, deliveryId: string): Promise<SubmissionReceipt>;
}
