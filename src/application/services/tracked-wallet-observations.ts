import type {
  TrackedWalletPurchaseObservation,
  TrackedWalletPurchasePort,
} from "../ports/stream.js";
import type { Timestamp, WalletAddress, WalletId } from "../../domain/shared/types.js";

export interface TrackedWalletObservationRepository {
  loadTrackedWallets(): Promise<
    readonly {
      walletId: WalletId;
      wallet: WalletAddress;
      afterSignature: string | null;
    }[]
  >;
  recordPurchases(input: {
    walletId: WalletId;
    observations: readonly TrackedWalletPurchaseObservation[];
    observedAt: Timestamp;
  }): Promise<number>;
}

/** Polls only qualified wallets and advances each cursor atomically with its evidence. */
export async function runTrackedWalletObservationCycle(input: {
  readonly source: TrackedWalletPurchasePort;
  readonly repository: TrackedWalletObservationRepository;
  readonly now: () => Timestamp;
}): Promise<number> {
  let inserted = 0;
  for (const wallet of await input.repository.loadTrackedWallets()) {
    const observedAt = input.now();
    const observations = await input.source.observePurchases({
      ...wallet,
      requestedAt: observedAt,
    });
    if (
      observations.some(
        (item) => item.walletId !== wallet.walletId || item.wallet !== wallet.wallet,
      )
    )
      throw new Error("Wallet observation source returned mismatched authority");
    inserted += await input.repository.recordPurchases({
      walletId: wallet.walletId,
      observations,
      observedAt,
    });
  }
  return inserted;
}
