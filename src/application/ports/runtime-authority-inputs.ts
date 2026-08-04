import type { TokenSecuritySnapshot } from "../../domain/token/security.js";
import type {
  MintAddress,
  RawAmount,
  Timestamp,
  WalletAddress,
} from "../../domain/shared/types.js";
import type { MonitoringRuntimeHistory } from "../services/execution-runtime-authority.js";

export interface AuthorityTrackedWallet {
  readonly wallet: WalletAddress;
  readonly entryBalanceRaw: RawAmount;
}

export interface PositionRuntimeAuthorityBaseline {
  readonly capturedAt: Timestamp;
  readonly wallet: WalletAddress;
  readonly tokenMint: MintAddress;
  readonly settlementMint: MintAddress;
  readonly developerRelated: readonly AuthorityTrackedWallet[];
  readonly originatingTierA: AuthorityTrackedWallet | null;
  readonly confirmingTierB: readonly [AuthorityTrackedWallet, AuthorityTrackedWallet] | null;
  readonly excludedHolderTokenAccounts: ReadonlySet<string>;
  readonly entrySecurity: TokenSecuritySnapshot;
  readonly history: MonitoringRuntimeHistory;
}

export interface RuntimeAuthorityBaselineSource {
  load(positionId: string): Promise<PositionRuntimeAuthorityBaseline>;
}

export interface MintSecurityObservationPort {
  observe(
    mint: MintAddress,
    excludedHolderTokenAccounts: ReadonlySet<string>,
    requestedAt: Timestamp,
  ): Promise<TokenSecuritySnapshot>;
}
